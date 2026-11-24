begin;

-- Account creation and club access are separate. Only a trusted operator grants access.
create table public.club_members (
  user_id uuid primary key references public.clients(id) on delete cascade
);
alter table public.club_members enable row level security;
revoke all on public.club_members from public, anon, authenticated;

create function public.has_club_access()
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.is_club_admin()
    or exists (select 1 from public.club_members where user_id = (select auth.uid()));
$$;

revoke all on function public.has_club_access() from public, anon, authenticated;
grant execute on function public.has_club_access() to authenticated;

revoke select on public.barbers, public.services, public.store_products from public, anon;
alter policy barbers_read on public.barbers to authenticated using ((select public.has_club_access()));
alter policy services_read on public.services to authenticated using ((select public.has_club_access()));
alter policy products_read on public.store_products to authenticated using ((select public.has_club_access()));
alter policy club_notices_read on public.club_notices using ((select public.has_club_access()));
alter policy club_suggestions_submit on public.club_suggestions
  with check ((select public.has_club_access()) and client_id = (select auth.uid()) and reviewed_at is null);

-- Existing photo references remain intact. The client signs URLs for this bucket.
update storage.buckets set public = false where id = 'barber-photos';
create policy barber_photos_member_read on storage.objects for select to authenticated
  using (bucket_id = 'barber-photos' and (select public.has_club_access()) and exists (
    select 1 from public.barbers b
    where right(b.foto_pixel, length('/storage/v1/object/public/barber-photos/' || storage.objects.name))
      = '/storage/v1/object/public/barber-photos/' || storage.objects.name
  ));

create schema club_private;
revoke all on schema club_private from public, anon, authenticated;

alter function public.get_available_slots(uuid, uuid, date) set schema club_private;
revoke all on function club_private.get_available_slots(uuid, uuid, date) from public, anon, authenticated;

create function public.get_available_slots(p_barber_id uuid, p_service_id uuid, p_date date)
returns table (starts_at timestamptz, available boolean)
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.has_club_access() then
    raise exception 'Acesso ao clube pendente de aprovação.' using errcode = '42501';
  end if;
  return query select * from club_private.get_available_slots(p_barber_id, p_service_id, p_date);
end;
$$;
revoke all on function public.get_available_slots(uuid, uuid, date) from public, anon, authenticated;
grant execute on function public.get_available_slots(uuid, uuid, date) to authenticated;

alter function public.create_appointment(uuid, uuid, timestamptz) set schema club_private;
revoke all on function club_private.create_appointment(uuid, uuid, timestamptz) from public, anon, authenticated;

create function public.create_appointment(p_barber_id uuid, p_service_id uuid, p_starts_at timestamptz)
returns uuid
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.has_club_access() then
    raise exception 'Acesso ao clube pendente de aprovação.' using errcode = '42501';
  end if;
  return club_private.create_appointment(p_barber_id, p_service_id, p_starts_at);
end;
$$;
revoke all on function public.create_appointment(uuid, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.create_appointment(uuid, uuid, timestamptz) to authenticated;

alter function public.get_mural_notices() set schema club_private;
revoke all on function club_private.get_mural_notices() from public, anon, authenticated;

create function public.get_mural_notices()
returns table (id uuid, title text, body text, photo_paths text[], created_at timestamptz,
  tagged_name text, tagged_avatar text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.has_club_access() then
    raise exception 'Acesso ao clube pendente de aprovação.' using errcode = '42501';
  end if;
  return query select * from club_private.get_mural_notices();
end;
$$;
revoke all on function public.get_mural_notices() from public, anon, authenticated;
grant execute on function public.get_mural_notices() to authenticated;

alter function public.get_club_posts(boolean, integer, integer) set schema club_private;
revoke all on function club_private.get_club_posts(boolean, integer, integer) from public, anon, authenticated;

create function public.get_club_posts(p_portfolio boolean, p_limit integer default 4, p_offset integer default 0)
returns table (id uuid, title text, body text, photo_paths text[], created_at timestamptz,
  tagged_name text, tagged_avatar text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.has_club_access() then
    raise exception 'Acesso ao clube pendente de aprovação.' using errcode = '42501';
  end if;
  return query select * from club_private.get_club_posts(p_portfolio, p_limit, p_offset);
end;
$$;
revoke all on function public.get_club_posts(boolean, integer, integer) from public, anon, authenticated;
grant execute on function public.get_club_posts(boolean, integer, integer) to authenticated;

alter function public.get_cut_albums(uuid, integer, integer) set schema club_private;
revoke all on function club_private.get_cut_albums(uuid, integer, integer) from public, anon, authenticated;

create function public.get_cut_albums(p_barber_id uuid, p_limit integer default 3, p_offset integer default 0)
returns table (id uuid, title text, body text, photo_paths text[], created_at timestamptz,
  tagged_name text, tagged_avatar text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.has_club_access() then
    raise exception 'Acesso ao clube pendente de aprovação.' using errcode = '42501';
  end if;
  return query select * from club_private.get_cut_albums(p_barber_id, p_limit, p_offset);
end;
$$;
revoke all on function public.get_cut_albums(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.get_cut_albums(uuid, integer, integer) to authenticated;

alter function public.buy_avatar_item(uuid) set schema club_private;
revoke all on function club_private.buy_avatar_item(uuid) from public, anon, authenticated;

create function public.buy_avatar_item(p_product_id uuid)
returns table (points_balance integer)
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.has_club_access() then
    raise exception 'Acesso ao clube pendente de aprovação.' using errcode = '42501';
  end if;
  return query select * from club_private.buy_avatar_item(p_product_id);
end;
$$;
revoke all on function public.buy_avatar_item(uuid) from public, anon, authenticated;
grant execute on function public.buy_avatar_item(uuid) to authenticated;

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
  )
  order by "position"
  limit least(greatest(coalesce(p_limit, 50), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

commit;
