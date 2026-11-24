begin;

create function public.cancel_club_appointment(p_appointment_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_club_admin() then raise exception 'Acesso restrito.' using errcode = '42501'; end if;

  update public.appointments
  set status = 'CANCELADO', cancelled_at = clock_timestamp()
  where id = p_appointment_id and status = 'AGENDADO';
  return found;
end;
$$;

revoke all on function public.cancel_club_appointment(uuid) from public, anon, authenticated;
grant execute on function public.cancel_club_appointment(uuid) to authenticated;

commit;
