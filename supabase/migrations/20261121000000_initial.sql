begin;

create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;
set local search_path = public, extensions, pg_catalog;

create type public.appointment_status as enum ('AGENDADO', 'CONCLUIDO', 'CANCELADO', 'NO_SHOW');
create type public.product_category as enum ('BEBIDA', 'GULOSEIMA', 'PRODUTO_BARBA', 'ACESSORIO_AVATAR');
create type public.point_type as enum ('LOGIN', 'JOGO', 'CORTE', 'COMPRA', 'FALTA_NO_SHOW', 'RESGATE_AVATAR');

create table public.clients (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null check (char_length(btrim(nome)) between 2 and 80),
  avatar_skin text not null check (avatar_skin in ('fade', 'bigode', 'pompadour', 'trancas')),
  level integer not null default 1 check (level >= 1),
  points_balance integer not null default 0 check (points_balance >= 0),
  streak_days integer not null default 0 check (streak_days >= 0),
  consent_terms boolean not null check (consent_terms),
  consent_terms_at timestamptz not null,
  consent_version text not null
);

create table public.barbers (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  especialidade text not null,
  foto_pixel text
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  duracao_minutos integer not null check (duracao_minutos > 0),
  preco_reais numeric(10,2) not null check (preco_reais >= 0),
  pontos_recompensa integer not null default 0 check (pontos_recompensa >= 0)
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  barber_id uuid not null references public.barbers(id),
  service_id uuid not null references public.services(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  data date generated always as ((starts_at at time zone 'America/Recife')::date) stored,
  hora time generated always as ((starts_at at time zone 'America/Recife')::time) stored,
  status public.appointment_status not null default 'AGENDADO',
  cancelled_at timestamptz,
  check (ends_at > starts_at),
  check ((status = 'CANCELADO') = (cancelled_at is not null)),
  exclude using gist (barber_id with =, tstzrange(starts_at, ends_at, '[)') with &&)
    where (status <> 'CANCELADO'),
  exclude using gist (client_id with =, tstzrange(starts_at, ends_at, '[)') with &&)
    where (status <> 'CANCELADO')
);

create index appointments_client_start_idx on public.appointments (client_id, starts_at);

create table public.store_products (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  categoria public.product_category not null,
  preco_reais numeric(10,2),
  preco_pontos integer,
  estoque integer not null default 0 check (estoque >= 0),
  check (
    (categoria = 'ACESSORIO_AVATAR' and preco_reais is null and preco_pontos is not null and preco_pontos > 0)
    or
    (categoria <> 'ACESSORIO_AVATAR' and preco_pontos is null and preco_reais is not null and preco_reais > 0)
  )
);

create table public.point_ledger (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  quantidade integer not null,
  tipo public.point_type not null,
  descricao text not null,
  event_key text not null check (btrim(event_key) <> ''),
  created_at timestamptz not null default now(),
  unique (client_id, tipo, event_key),
  check (case
    when tipo = 'FALTA_NO_SHOW' then quantidade <= 0
    when tipo = 'RESGATE_AVATAR' then quantidade < 0
    else quantidade > 0
  end)
);

create index point_ledger_client_created_idx on public.point_ledger (client_id, created_at desc);

create function public.create_client_on_signup()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if (new.raw_user_meta_data -> 'consent_terms') is distinct from 'true'::jsonb
    or (new.raw_user_meta_data ->> 'consent_version') is distinct from '2026-11-21-preview'
  then
    raise exception 'Aceite dos termos e da política obrigatório.' using errcode = '23514';
  end if;

  insert into public.clients (id, nome, avatar_skin, consent_terms, consent_terms_at, consent_version)
  values (
    new.id, btrim(new.raw_user_meta_data ->> 'nome'),
    new.raw_user_meta_data ->> 'avatar_skin', true, statement_timestamp(), '2026-11-21-preview'
  );
  return new;
end;
$$;

create trigger create_pixel_barber_client
after insert on auth.users
for each row execute function public.create_client_on_signup();

create function public.cancel_appointment(p_appointment_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
begin
  perform 1 from public.appointments
  where id = p_appointment_id and client_id = auth.uid() and status = 'AGENDADO'
  for update;

  if not found then
    return false;
  end if;

  update public.appointments
  set status = 'CANCELADO', cancelled_at = clock_timestamp()
  where id = p_appointment_id and starts_at >= clock_timestamp() + interval '15 minutes';
  return found;
end;
$$;

create function public.post_points(
  p_client_id uuid, p_quantity integer, p_type public.point_type, p_description text, p_event_key text
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  current_balance integer;
  delta integer := p_quantity;
  ledger_id uuid;
begin
  select points_balance into strict current_balance
  from public.clients where id = p_client_id for update;

  select id into ledger_id from public.point_ledger
  where client_id = p_client_id and tipo = p_type and event_key = p_event_key;

  if found then
    return ledger_id;
  end if;

  if p_type = 'FALTA_NO_SHOW' and p_quantity < 0 then
    delta := greatest(p_quantity, -current_balance);
  end if;
  if current_balance + delta < 0 then
    raise exception 'Saldo de pontos insuficiente.' using errcode = '23514';
  end if;

  insert into public.point_ledger (client_id, quantidade, tipo, descricao, event_key)
  values (p_client_id, delta, p_type, p_description, p_event_key)
  returning id into ledger_id;

  update public.clients set points_balance = current_balance + delta where id = p_client_id;
  return ledger_id;
end;
$$;

alter table public.clients enable row level security;
alter table public.barbers enable row level security;
alter table public.services enable row level security;
alter table public.appointments enable row level security;
alter table public.store_products enable row level security;
alter table public.point_ledger enable row level security;

revoke all on public.clients, public.barbers, public.services, public.appointments,
  public.store_products, public.point_ledger from public, anon, authenticated;
grant select on public.clients, public.appointments, public.point_ledger to authenticated;
grant update (nome, avatar_skin) on public.clients to authenticated;
grant select on public.barbers, public.services, public.store_products to anon, authenticated;
grant all on public.clients, public.barbers, public.services, public.appointments,
  public.store_products, public.point_ledger to service_role;

create policy clients_read_self on public.clients for select to authenticated using (id = (select auth.uid()));
create policy clients_update_self on public.clients for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy appointments_read_self on public.appointments for select to authenticated
  using (client_id = (select auth.uid()));
create policy ledger_read_self on public.point_ledger for select to authenticated
  using (client_id = (select auth.uid()));
create policy barbers_read on public.barbers for select to anon, authenticated using (true);
create policy services_read on public.services for select to anon, authenticated using (true);
create policy products_read on public.store_products for select to anon, authenticated using (true);

revoke all on function public.create_client_on_signup() from public, anon, authenticated;
revoke all on function public.cancel_appointment(uuid) from public, anon, authenticated;
grant execute on function public.cancel_appointment(uuid) to authenticated;
revoke all on function public.post_points(uuid, integer, public.point_type, text, text) from public, anon, authenticated;
grant execute on function public.post_points(uuid, integer, public.point_type, text, text) to service_role;

insert into public.services (nome, duracao_minutos, preco_reais, pontos_recompensa)
values ('Corte', 30, 45.00, 9), ('Barba', 25, 35.00, 7), ('Combo', 55, 75.00, 15);

commit;
