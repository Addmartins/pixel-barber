begin;

-- Restringe leitura de barbeiros e fotos apenas para membros aprovados
revoke select on public.barbers from anon;
alter policy barbers_read on public.barbers to authenticated using ((select public.has_club_access()));

-- Restringe verificação de horários e criação de agendamento real para membros aprovados
create or replace function public.get_available_slots(p_barber_id uuid, p_service_id uuid, p_date date)
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

create or replace function public.create_appointment(p_barber_id uuid, p_service_id uuid, p_starts_at timestamptz)
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

-- Restringe leitura de agendamentos reais apenas para membros aprovados
alter policy appointments_read_self on public.appointments to authenticated
  using (client_id = (select auth.uid()) and (select public.has_club_access()));

-- Restringe visualização de fotos de barbeiros
update storage.buckets set public = false where id = 'barber-photos';
drop policy if exists barber_photos_member_read on storage.objects;
create policy barber_photos_member_read on storage.objects for select to authenticated
  using (bucket_id = 'barber-photos' and (select public.has_club_access()));

commit;
