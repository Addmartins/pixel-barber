-- Run on a migrated test database. Fixtures are rolled back.
begin;

do $$
declare
  admin_id uuid := gen_random_uuid();
  client_id uuid := gen_random_uuid();
  barber_a uuid;
  barber_b uuid;
  service_id uuid;
  booking_id uuid;
  album_id uuid;
  target_day date := current_date + 1;
  local_start timestamptz := (target_day + time '09:00') at time zone 'America/Recife';
  photo_path text := admin_id::text || '/' || gen_random_uuid()::text || '.jpg';
  metadata jsonb := '{"nome":"Teste Agenda","avatar_skin":"fade","consent_terms":true,"consent_version":"2026-11-21-phone-preview"}';
begin
  insert into auth.users (id, phone, raw_user_meta_data) values
    (admin_id, '5581777700081', metadata), (client_id, '5581777700082', metadata);
  insert into public.club_admins values (admin_id);
  insert into public.barbers (nome, especialidade) values ('Barbeiro teste A', 'Corte') returning id into barber_a;
  insert into public.barbers (nome, especialidade) values ('Barbeiro teste B', 'Corte') returning id into barber_b;
  select id into strict service_id from public.services where nome = 'Corte';
  insert into public.appointments (client_id, barber_id, service_id, starts_at, ends_at)
  values (client_id, barber_a, service_id, local_start, local_start + interval '30 minutes')
  returning id into booking_id;

  perform set_config('request.jwt.claim.sub', client_id::text, true);
  set local role authenticated;
  begin
    perform public.delete_club_appointment(booking_id);
    raise exception 'Cliente excluiu agendamento pelo painel';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.get_club_appointments(target_day, barber_a);
    raise exception 'Cliente abriu agenda administrativa';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  if not exists (select from public.get_club_appointments(target_day) where id = booking_id)
    or not exists (select from public.get_club_appointments(target_day, barber_a) where id = booking_id)
    or exists (select from public.get_club_appointments(target_day, barber_b) where id = booking_id) then
    raise exception 'Filtro por barbeiro trouxe o resultado incorreto';
  end if;

  insert into storage.objects (bucket_id, name) values ('club-mural', photo_path);
  album_id := public.publish_cut_album(barber_a, 'Álbum de teste', '', array[photo_path]);
  if not exists (select from public.club_notices where id = album_id and barber_id = barber_a) then
    raise exception 'Álbum com foto enviada não ficou vinculado ao barbeiro';
  end if;

  if not public.delete_club_appointment(booking_id) or public.delete_club_appointment(booking_id) then
    raise exception 'Exclusão do agendamento falhou';
  end if;
  if exists (select from public.get_club_appointments(target_day, barber_a) where id = booking_id) then
    raise exception 'Agendamento excluído ainda aparece na agenda';
  end if;
  delete from public.barbers where id = barber_a;
  if not found then raise exception 'Barbeiro sem agendamentos não foi excluído'; end if;
  reset role;
end;
$$;

rollback;
