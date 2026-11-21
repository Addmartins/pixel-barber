begin;

insert into public.barbers (nome, especialidade)
select seed.nome, seed.especialidade
from (values
  ('Mestre Navalha', 'Corte clássico e barba'),
  ('Du Corte', 'Degradê e fade')
) as seed(nome, especialidade)
where not exists (select 1 from public.barbers where barbers.nome = seed.nome);

create function public.get_available_slots(p_barber_id uuid, p_service_id uuid, p_date date)
returns table (starts_at timestamptz, available boolean)
language plpgsql security definer set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  duration_minutes integer;
  closing_at timestamptz;
  checked_at timestamptz := statement_timestamp();
begin
  if not exists (select 1 from public.clients where id = caller_id) then
    raise exception 'Entre na sua conta para consultar a agenda.' using errcode = '42501';
  end if;

  select duracao_minutos into duration_minutes from public.services where id = p_service_id;
  if duration_minutes is null or not exists (select 1 from public.barbers where id = p_barber_id)
    or p_date is null or not isfinite(p_date) then
    raise exception 'Serviço, barbeiro ou data inválidos.' using errcode = '22023';
  end if;

  closing_at := (p_date + time '19:00') at time zone 'America/Sao_Paulo';
  return query
    select slots.start_at,
      slots.start_at > checked_at
      and slots.end_at <= closing_at
      and not exists (
        select 1 from public.appointments as booking
        where booking.status <> 'CANCELADO'
          and (booking.barber_id = p_barber_id or booking.client_id = caller_id)
          and tstzrange(booking.starts_at, booking.ends_at, '[)') &&
            tstzrange(slots.start_at, slots.end_at, '[)')
      )
    from (
      select
        start_at,
        start_at + make_interval(mins => duration_minutes) as end_at
      from generate_series(
        p_date + time '09:00',
        p_date + time '18:30',
        interval '30 minutes'
      ) as local_slot(local_start)
      cross join lateral (
        select local_slot.local_start at time zone 'America/Sao_Paulo' as start_at
      ) as utc_slot
    ) as slots
    order by slots.start_at;
end;
$$;

create function public.create_appointment(p_barber_id uuid, p_service_id uuid, p_starts_at timestamptz)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  duration_minutes integer;
  start_local timestamp;
  closing_at timestamptz;
  end_at timestamptz;
  appointment_id uuid;
begin
  if not exists (select 1 from public.clients where id = caller_id) then
    raise exception 'Entre na sua conta para reservar um horário.' using errcode = '42501';
  end if;

  select duracao_minutos into duration_minutes from public.services where id = p_service_id;
  if duration_minutes is null or not exists (select 1 from public.barbers where id = p_barber_id)
    or p_starts_at is null or not isfinite(p_starts_at) then
    raise exception 'Serviço, barbeiro ou horário inválidos.' using errcode = '22023';
  end if;

  start_local := p_starts_at at time zone 'America/Sao_Paulo';
  closing_at := (start_local::date + time '19:00') at time zone 'America/Sao_Paulo';
  end_at := p_starts_at + make_interval(mins => duration_minutes);
  if p_starts_at <= clock_timestamp()
    or start_local::time < time '09:00'
    or extract(minute from start_local) not in (0, 30)
    or extract(second from start_local) <> 0
    or end_at > closing_at then
    raise exception 'Escolha um horário futuro dentro do expediente de Brasília.' using errcode = '22023';
  end if;

  -- The existing exclusion constraints serialize overlapping reservations.
  insert into public.appointments (client_id, barber_id, service_id, starts_at, ends_at)
  values (caller_id, p_barber_id, p_service_id, p_starts_at, end_at)
  returning id into appointment_id;

  return appointment_id;
end;
$$;

create function public.get_leaderboard(p_limit integer default 50, p_offset integer default 0)
returns table ("position" bigint, display_name text, avatar_skin text, points_balance integer)
language sql stable security definer set search_path = ''
as $$
  select
    row_number() over (order by member.points_balance desc, member.id) as "position",
    split_part(btrim(regexp_replace(member.nome, '[[:space:]]+', ' ', 'g')), ' ', 1) as display_name,
    member.avatar_skin,
    member.points_balance
  from public.clients as member
  where (select auth.uid()) is not null
  order by "position"
  limit least(greatest(coalesce(p_limit, 50), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all on function public.get_available_slots(uuid, uuid, date) from public, anon, authenticated;
revoke all on function public.create_appointment(uuid, uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.get_leaderboard(integer, integer) from public, anon, authenticated;
grant execute on function public.get_available_slots(uuid, uuid, date) to authenticated;
grant execute on function public.create_appointment(uuid, uuid, timestamptz) to authenticated;
grant execute on function public.get_leaderboard(integer, integer) to authenticated;

commit;
