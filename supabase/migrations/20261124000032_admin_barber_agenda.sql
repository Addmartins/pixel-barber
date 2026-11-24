begin;

-- A segunda assinatura preserva chamadas existentes que enviam apenas a data.
create function public.get_club_appointments(p_day date, p_barber_id uuid)
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
  where a.data = p_day and (p_barber_id is null or a.barber_id = p_barber_id)
  order by a.starts_at, a.id;
end;
$$;

create or replace function public.get_club_appointments(p_day date)
returns table (id uuid, starts_at timestamptz, ends_at timestamptz, status public.appointment_status,
  client_name text, barber_name text, service_name text)
language sql stable security definer set search_path = ''
as $$
  select * from public.get_club_appointments(p_day, null::uuid);
$$;

create function public.delete_club_appointment(p_appointment_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_club_admin() then raise exception 'Acesso restrito.' using errcode = '42501'; end if;
  delete from public.appointments
  where id = p_appointment_id and status in ('AGENDADO', 'CANCELADO');
  return found;
end;
$$;

revoke all on function public.get_club_appointments(date, uuid), public.delete_club_appointment(uuid)
  from public, anon, authenticated;
grant execute on function public.get_club_appointments(date, uuid), public.delete_club_appointment(uuid)
  to authenticated;

-- Garante a consulta de vínculos dos álbuns em ambientes com a concessão anterior pendente.
grant select (id, barber_id) on public.club_notices to authenticated;

commit;
