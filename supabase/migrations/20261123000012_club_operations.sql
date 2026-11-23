begin;

create table public.club_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
create table public.club_notices (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 100),
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create table public.club_suggestions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create table public.club_point_rules (
  singleton boolean primary key default true check (singleton),
  validity_days integer not null check (validity_days > 0)
);
insert into public.club_point_rules (validity_days) values (90);

create table public.appointment_penalties (
  appointment_id uuid primary key references public.appointments(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  week_start timestamptz not null,
  applied_percent integer not null check (applied_percent between 0 and 50),
  ranking_points integer not null check (ranking_points >= 0)
);
create index appointment_penalties_week_idx on public.appointment_penalties (week_start, client_id);
create index appointments_data_idx on public.appointments (data);
create index club_notices_created_idx on public.club_notices (created_at desc);
create index point_ledger_week_credits_idx on public.point_ledger (created_at, client_id) where quantidade > 0;

alter table public.club_admins enable row level security;
alter table public.club_notices enable row level security;
alter table public.club_suggestions enable row level security;
alter table public.club_point_rules enable row level security;
alter table public.appointment_penalties enable row level security;
revoke all on public.club_admins, public.club_notices, public.club_suggestions, public.club_point_rules,
  public.appointment_penalties from public, anon, authenticated;

create function public.is_club_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.club_admins where user_id = (select auth.uid()));
$$;

grant select, insert, delete on public.club_notices to authenticated;
grant insert (client_id, body), select on public.club_suggestions to authenticated;
grant update (reviewed_at) on public.club_suggestions to authenticated;
grant insert (nome, especialidade) on public.barbers to authenticated;
create policy club_notices_read on public.club_notices for select to authenticated using (true);
create policy club_notices_insert on public.club_notices for insert to authenticated
  with check ((select public.is_club_admin()));
create policy club_notices_delete on public.club_notices for delete to authenticated
  using ((select public.is_club_admin()));
create policy club_suggestions_submit on public.club_suggestions for insert to authenticated
  with check (client_id = (select auth.uid()) and reviewed_at is null);
create policy club_suggestions_read on public.club_suggestions for select to authenticated
  using ((select public.is_club_admin()));
create policy club_suggestions_review on public.club_suggestions for update to authenticated
  using ((select public.is_club_admin())) with check ((select public.is_club_admin()));
create policy club_barbers_insert on public.barbers for insert to authenticated
  with check ((select public.is_club_admin()) and char_length(btrim(nome)) between 1 and 80
    and char_length(btrim(especialidade)) between 1 and 100);

alter table public.point_ledger drop constraint point_ledger_check,
  add constraint point_ledger_quantity_check check (case
    when tipo = 'FALTA_NO_SHOW' then quantidade <= 0
    when tipo in ('RESGATE_AVATAR', 'EXPIRACAO') then quantidade < 0
    else quantidade > 0
  end);

create function public.club_week_start(p_at timestamptz)
returns timestamptz language sql immutable strict set search_path = ''
as $$
  select date_trunc('week', p_at at time zone 'America/Recife') at time zone 'America/Recife';
$$;

create function public.expire_client_points(p_client_id uuid)
returns integer language plpgsql security definer set search_path = ''
as $$
declare
  balance integer;
  expired integer;
  cutoff timestamptz;
begin
  select points_balance into strict balance from public.clients where id = p_client_id for update;
  if balance = 0 then return 0; end if;

  select statement_timestamp() - make_interval(hours => validity_days * 24) into strict cutoff
  from public.club_point_rules where singleton;

  -- Every debit consumes the oldest available credit. Earlier expirations are debits too.
  select least(balance, greatest(0, coalesce(sum(quantidade), 0)))::integer into expired
  from public.point_ledger
  where client_id = p_client_id and (quantidade < 0 or created_at <= cutoff);

  if expired > 0 then
    insert into public.point_ledger (client_id, quantidade, tipo, descricao, event_key, created_at)
    values (p_client_id, -expired, 'EXPIRACAO', 'Expiração de pontos', gen_random_uuid()::text, clock_timestamp());
    balance := balance - expired;
    update public.clients set points_balance = balance where id = p_client_id;
  end if;
  return balance;
end;
$$;

create function public.get_current_points_balance()
returns integer language plpgsql security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'Sessão indisponível.' using errcode = '42501'; end if;
  return public.expire_client_points(auth.uid());
end;
$$;

create function public.get_club_appointments(p_day date)
returns table (id uuid, starts_at timestamptz, ends_at timestamptz, status public.appointment_status,
  client_name text, barber_name text, service_name text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_club_admin() then raise exception 'Acesso restrito.' using errcode = '42501'; end if;
  return query select a.id, a.starts_at, a.ends_at, a.status, c.nome, b.nome, s.nome
  from public.appointments a
  join public.clients c on c.id = a.client_id
  join public.barbers b on b.id = a.barber_id
  join public.services s on s.id = a.service_id
  where a.data = p_day
  order by a.starts_at, a.id;
end;
$$;

create function public.get_club_metrics()
returns table (scheduled bigint, completed bigint, cancelled bigint, missed bigint, pending_suggestions bigint)
language plpgsql stable security definer set search_path = ''
as $$
declare
  week_date date := (public.club_week_start(statement_timestamp()) at time zone 'America/Recife')::date;
begin
  if not public.is_club_admin() then raise exception 'Acesso restrito.' using errcode = '42501'; end if;
  return query select
    count(*) filter (where status = 'AGENDADO'),
    count(*) filter (where status = 'CONCLUIDO'),
    count(*) filter (where status = 'CANCELADO'),
    count(*) filter (where status = 'NO_SHOW'),
    (select count(*) from public.club_suggestions where reviewed_at is null)
  from public.appointments where data >= week_date and data < week_date + 7;
end;
$$;

create function public.set_club_attendance(p_id uuid, p_status public.appointment_status)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  appointment public.appointments%rowtype;
  week_at timestamptz;
  streak integer;
  prior_percent integer;
  prior_points bigint;
  earned bigint;
  applied integer;
  penalty integer;
begin
  if not public.is_club_admin() then raise exception 'Acesso restrito.' using errcode = '42501'; end if;
  if p_status is null or p_status not in ('CONCLUIDO', 'NO_SHOW') then
    raise exception 'Status inválido.' using errcode = '22023';
  end if;
  select * into appointment from public.appointments where id = p_id for update;
  if not found or appointment.status <> 'AGENDADO' or appointment.ends_at > clock_timestamp() then
    return false;
  end if;
  perform 1 from public.clients where id = appointment.client_id for update;
  if exists (select 1 from public.appointments
    where client_id = appointment.client_id and starts_at < appointment.starts_at
      and status = 'AGENDADO' and ends_at <= clock_timestamp()) then
    raise exception 'Registre primeiro o agendamento anterior deste cliente.' using errcode = 'PT409';
  end if;
  update public.appointments set status = p_status where id = p_id;
  if p_status = 'CONCLUIDO' then return true; end if;

  select count(*)::integer into streak from public.appointments
  where client_id = appointment.client_id and status = 'NO_SHOW' and starts_at < appointment.starts_at
    and starts_at > coalesce((select max(starts_at) from public.appointments
      where client_id = appointment.client_id and status = 'CONCLUIDO'
        and starts_at < appointment.starts_at), '-infinity'::timestamptz);

  week_at := public.club_week_start(appointment.starts_at);
  select coalesce(sum(applied_percent), 0), coalesce(sum(ranking_points), 0) into prior_percent, prior_points
  from public.appointment_penalties where client_id = appointment.client_id and week_start = week_at;
  select coalesce(sum(quantidade), 0) into earned from public.point_ledger
  where client_id = appointment.client_id and quantidade > 0
    and created_at >= week_at and created_at < week_at + interval '168 hours';

  applied := least(20 + least(streak, 3) * 10, greatest(0, 50 - prior_percent));
  penalty := least(earned * applied / 100, greatest(0, earned / 2 - prior_points))::integer;
  insert into public.appointment_penalties values (p_id, appointment.client_id, week_at, applied, penalty);
  perform public.post_points(appointment.client_id, -penalty, 'FALTA_NO_SHOW',
    'Falta ao agendamento (' || applied || '% dos ganhos da semana)', p_id::text);
  return true;
end;
$$;

create or replace function public.post_points(
  p_client_id uuid, p_quantity integer, p_type public.point_type, p_description text, p_event_key text
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  current_balance integer;
  delta integer := p_quantity;
  ledger_id uuid;
begin
  current_balance := public.expire_client_points(p_client_id);

  select id into ledger_id from public.point_ledger
  where client_id = p_client_id and tipo = p_type and event_key = p_event_key;

  if found then
    return ledger_id;
  end if;

  if p_type = 'FALTA_NO_SHOW' and p_quantity < 0 then
    delta := greatest(p_quantity, -current_balance);
  end if;
  if current_balance + delta < 0 then
    raise exception 'Saldo de pontos insuficiente.' using errcode = 'PT422';
  end if;

  insert into public.point_ledger (client_id, quantidade, tipo, descricao, event_key, created_at)
  values (p_client_id, delta, p_type, p_description, p_event_key, clock_timestamp())
  returning id into ledger_id;

  update public.clients set points_balance = current_balance + delta where id = p_client_id;
  return ledger_id;
end;
$$;

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
  where (select auth.uid()) is not null
  order by "position"
  limit least(greatest(coalesce(p_limit, 50), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

create or replace function public.buy_avatar_item(p_product_id uuid)
returns table (points_balance integer)
language plpgsql security definer set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  balance integer;
  product public.store_products%rowtype;
  purchase_id uuid := gen_random_uuid();
begin
  select owner.points_balance into balance
  from public.clients as owner where owner.id = owner_id for update;
  if not found then
    raise exception 'Perfil indisponível.' using errcode = '42501';
  end if;

  balance := public.expire_client_points(owner_id);

  if exists (select 1 from public.client_inventory as item
    where item.client_id = owner_id and item.product_id = p_product_id) then
    return query select balance;
    return;
  end if;

  select catalog.* into product from public.store_products as catalog
  where catalog.id = p_product_id and catalog.categoria = 'ACESSORIO_AVATAR'
    and catalog.cosmetic_code is not null and catalog.preco_pontos > 0
  for update;
  if not found then
    raise exception 'Item fora do catálogo.' using errcode = 'PT404';
  end if;
  if product.estoque < 1 then
    raise exception 'Item sem estoque.' using errcode = 'PT409';
  end if;
  if balance < product.preco_pontos then
    raise exception 'Saldo de pontos insuficiente.' using errcode = 'PT422';
  end if;

  perform public.post_points(owner_id, -product.preco_pontos, 'RESGATE_AVATAR',
    'Resgate: ' || product.nome, purchase_id::text);
  insert into public.client_inventory (id, client_id, product_id)
  values (purchase_id, owner_id, product.id);
  update public.store_products as catalog set estoque = catalog.estoque - 1
  where catalog.id = product.id;
  perform public.equip_avatar_item(product.id, true);

  return query select owner.points_balance from public.clients as owner where owner.id = owner_id;
end;
$$;

revoke all on function public.is_club_admin(), public.get_current_points_balance(),
  public.get_club_appointments(date), public.get_club_metrics(),
  public.set_club_attendance(uuid, public.appointment_status), public.expire_client_points(uuid),
  public.club_week_start(timestamptz) from public, anon, authenticated;
grant execute on function public.is_club_admin(), public.get_current_points_balance(),
  public.get_club_appointments(date), public.get_club_metrics(),
  public.set_club_attendance(uuid, public.appointment_status) to authenticated;

commit;
