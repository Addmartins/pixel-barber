begin;

create table club_private.location_access_sessions (
  user_id uuid not null references public.clients(id) on delete cascade,
  session_id text not null,
  location_updated_at timestamptz not null,
  expires_at timestamptz,
  primary key (user_id, session_id)
);

alter table club_private.location_access_sessions enable row level security;
revoke all on club_private.location_access_sessions from public, anon, authenticated;

create function public.get_club_access_status()
returns table (granted boolean, expires_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  with manual_access as (
    select public.is_club_admin() or exists (
      select 1 from public.club_members where user_id = (select auth.uid())
    ) as granted
  ), local_access as (
    select s.expires_at
    from club_private.location_access_sessions s
    join public.barbershop_location l on l.id = 1 and l.updated_at = s.location_updated_at
    where s.user_id = (select auth.uid())
      and s.session_id = (select auth.jwt() ->> 'session_id')
      and (s.expires_at is null or s.expires_at > statement_timestamp())
  )
  select m.granted or l.expires_at is not null,
    case when not m.granted then l.expires_at end
  from manual_access m left join local_access l on true;
$$;

revoke all on function public.get_club_access_status() from public, anon, authenticated;
grant execute on function public.get_club_access_status() to authenticated;

create or replace function public.has_club_access()
returns boolean language sql stable security definer set search_path = ''
as $$
  select granted from public.get_club_access_status();
$$;

revoke execute on function public.get_barbershop_location() from anon;
create or replace function public.get_barbershop_location()
returns table (city text, latitude double precision, longitude double precision, radius_km double precision)
language sql stable security definer set search_path = ''
as $$
  select l.city, l.latitude, l.longitude, l.radius_km
  from public.barbershop_location l
  where l.id = 1 and (select public.is_club_admin());
$$;

create or replace function public.update_barbershop_location(
  p_city text, p_latitude double precision, p_longitude double precision, p_radius_km double precision
)
returns boolean language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_club_admin() then
    raise exception 'Apenas administradores podem configurar a localização.' using errcode = '42501';
  end if;

  if p_city is null or char_length(btrim(p_city)) not between 1 and 100
    or p_latitude is null or p_latitude not between -90 and 90
    or p_longitude is null or p_longitude not between -180 and 180
    or p_radius_km is null or p_radius_km not between 1 and 500 then
    raise exception 'Informe uma localização e um raio válidos.' using errcode = '22023';
  end if;

  update public.barbershop_location
  set city = btrim(p_city), latitude = p_latitude, longitude = p_longitude,
    radius_km = p_radius_km, updated_at = clock_timestamp()
  where id = 1;
  return found;
end;
$$;

drop function public.verify_location_access(double precision, double precision);

create function public.verify_location_access(
  p_lat double precision, p_lng double precision, p_accuracy_m double precision
)
returns table (granted boolean, city text)
language plpgsql security definer set search_path = ''
as $$
declare
  requester uuid := auth.uid();
  current_session text := auth.jwt() ->> 'session_id';
  location public.barbershop_location%rowtype;
  haversine double precision;
  distance_km double precision;
begin
  if requester is null or nullif(current_session, '') is null then
    raise exception 'Sessão indisponível. Entre novamente para verificar sua localização.' using errcode = '42501';
  end if;

  if p_lat is null or p_lat not between -90 and 90
    or p_lng is null or p_lng not between -180 and 180
    or p_accuracy_m is null or p_accuracy_m < 0 or p_accuracy_m >= 'Infinity'::double precision then
    raise exception 'Localização inválida.' using errcode = '22023';
  end if;

  -- Serializa as verificações da conta e a aprovação manual.
  perform 1 from public.clients where id = requester for no key update;
  if not found then
    raise exception 'Conta indisponível.' using errcode = '42501';
  end if;

  select * into strict location from public.barbershop_location where id = 1;
  haversine := sin(radians(location.latitude - p_lat) / 2)^2
    + cos(radians(p_lat)) * cos(radians(location.latitude))
    * sin(radians(location.longitude - p_lng) / 2)^2;
  distance_km := 12742.0 * asin(sqrt(least(1.0, greatest(0.0, haversine))));

  if distance_km + p_accuracy_m / 1000.0 > location.radius_km then
    -- Conserva apenas o registro de participação no ranking.
    update club_private.location_access_sessions
    set expires_at = statement_timestamp()
    where user_id = requester and session_id = current_session and expires_at > statement_timestamp();
    return query select false, location.city;
    return;
  end if;

  delete from club_private.location_access_sessions
  where user_id = requester and expires_at <= statement_timestamp() and session_id <> current_session;

  insert into club_private.location_access_sessions (user_id, session_id, location_updated_at, expires_at)
  values (requester, current_session, location.updated_at, null)
  on conflict (user_id, session_id) do update
  set location_updated_at = excluded.location_updated_at, expires_at = null;

  return query select true, location.city;
end;
$$;

revoke all on function public.verify_location_access(double precision, double precision, double precision)
  from public, anon, authenticated;
grant execute on function public.verify_location_access(double precision, double precision, double precision)
  to authenticated;

alter policy club_mural_read on storage.objects
  using (bucket_id = 'club-mural' and (select public.has_club_access()) and (
    (select public.is_club_admin()) or exists (
      select 1 from public.club_notices n where n.photo_paths @> array[storage.objects.name]
    )
  ));

alter function public.cancel_appointment(uuid) set schema club_private;
revoke all on function club_private.cancel_appointment(uuid) from public, anon, authenticated;

create function public.cancel_appointment(p_appointment_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
begin
  if not public.has_club_access() then
    raise exception 'Acesso restrito à região ou mediante aprovação.' using errcode = '42501';
  end if;
  return club_private.cancel_appointment(p_appointment_id);
end;
$$;

revoke all on function public.cancel_appointment(uuid) from public, anon, authenticated;
grant execute on function public.cancel_appointment(uuid) to authenticated;

create or replace function public.get_leaderboard(p_limit integer default 50, p_offset integer default 0)
returns table (
  "position" bigint, display_name text, avatar_skin text, points_balance integer,
  mastered_games text[], equipped_cosmetics text[], shirt_number integer
)
language sql stable security definer set search_path = ''
as $$
  with week as (
    select public.club_week_start(statement_timestamp()) as starts_at
  ), earned as (
    select client_id, sum(quantidade) as points from public.point_ledger cross join week
    where quantidade > 0 and created_at >= starts_at and created_at < starts_at + interval '168 hours'
    group by client_id
  ), penalties as (
    select client_id, sum(ranking_points) as points from public.appointment_penalties cross join week
    where week_start = starts_at group by client_id
  )
  select
    row_number() over (order by total.points desc, member.id) as "position",
    split_part(btrim(regexp_replace(member.nome, '[[:space:]]+', ' ', 'g')), ' ', 1) as display_name,
    member.avatar_skin,
    total.points,
    array(
      select distinct achievement.game_code from public.game_scores as achievement
      where achievement.client_id = member.id and achievement.difficulty = 'HARD' and achievement.won
      order by achievement.game_code
    ),
    array(
      select product.cosmetic_code
      from public.client_inventory as item
      join public.store_products as product on product.id = item.product_id
      where item.client_id = member.id and item.is_equipped and product.cosmetic_code is not null
      order by product.cosmetic_slot, product.cosmetic_code
    ),
    shirt.shirt_number
  from public.clients as member
  join earned on earned.client_id = member.id
  left join penalties on penalties.client_id = member.id
  cross join lateral (select greatest(0, earned.points - coalesce(penalties.points, 0))::integer as points) as total
  left join lateral (
    select item.shirt_number
    from public.client_inventory as item
    join public.store_products as product on product.id = item.product_id
    where item.client_id = member.id and item.is_equipped and product.cosmetic_code = 'camisa_river'
  ) as shirt on true
  where (select public.has_club_access()) and (
    exists (select 1 from public.club_members approved where approved.user_id = member.id)
    or exists (select 1 from public.club_admins admin where admin.user_id = member.id)
    or exists (select 1 from club_private.location_access_sessions local where local.user_id = member.id)
  )
  order by "position"
  limit least(greatest(coalesce(p_limit, 50), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

commit;
