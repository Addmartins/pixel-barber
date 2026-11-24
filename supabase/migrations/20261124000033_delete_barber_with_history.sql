begin;

alter table public.appointments
  add column former_barber_name text,
  alter column barber_id drop not null,
  add constraint appointments_open_barber_required
    check (status <> 'AGENDADO' or barber_id is not null);

create function club_private.preserve_barber_appointment_history()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if exists (
    select 1 from public.appointments
    where barber_id = old.id and status = 'AGENDADO'
  ) then
    raise exception 'Este barbeiro ainda tem agendamentos em aberto.' using errcode = '23503';
  end if;

  update public.appointments
  set former_barber_name = old.nome, barber_id = null
  where barber_id = old.id and status <> 'AGENDADO';
  return old;
end;
$$;

revoke all on function club_private.preserve_barber_appointment_history() from public, anon, authenticated;

create trigger preserve_barber_appointment_history
before delete on public.barbers
for each row execute function club_private.preserve_barber_appointment_history();

create or replace function public.get_club_appointments(p_day date, p_barber_id uuid)
returns table (id uuid, starts_at timestamptz, ends_at timestamptz, status public.appointment_status,
  client_name text, barber_name text, service_name text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_club_admin() then raise exception 'Acesso restrito.' using errcode = '42501'; end if;
  return query select a.id, a.starts_at, a.ends_at, a.status, c.nome,
    coalesce(b.nome, a.former_barber_name), s.nome
  from public.appointments a
  join public.clients c on c.id = a.client_id
  left join public.barbers b on b.id = a.barber_id
  join public.services s on s.id = a.service_id
  where a.data = p_day and (p_barber_id is null or a.barber_id = p_barber_id)
  order by a.starts_at, a.id;
end;
$$;

commit;
