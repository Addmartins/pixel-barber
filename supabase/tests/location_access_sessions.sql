-- Run on a migrated test database. Fixtures are rolled back.
begin;

do $$
declare
  admin_id uuid := gen_random_uuid();
  client_id uuid := gen_random_uuid();
  local_session uuid := gen_random_uuid();
  remote_session uuid := gen_random_uuid();
  meta jsonb := '{"nome":"Cliente Teste","avatar_skin":"fade","consent_terms":true,"consent_version":"2026-11-21-phone-preview"}';
begin
  insert into auth.users (id, phone, raw_user_meta_data) values
    (admin_id, '5581777700071', meta), (client_id, '5581777700072', meta);
  insert into public.club_admins values (admin_id);
  perform public.post_points(client_id, 100, 'CORTE', 'Fixture localização', 'fixture-location-rank');

  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  set local role authenticated;
  perform public.update_barbershop_location('Região de teste', -7, -35, 10);
  perform set_config('request.jwt.claim.sub', client_id::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', client_id, 'session_id', local_session)::text, true);

  if public.has_club_access() or exists (select from public.get_barbershop_location()) then
    raise exception 'Cliente sem verificação recebeu acesso';
  end if;

  if (select granted from public.verify_location_access(-7, -35, 11000))
    or (select granted from public.verify_location_access(-8, -35, 20)) then
    raise exception 'Posição fora da região ou imprecisa recebeu acesso';
  end if;

  if not (select granted from public.verify_location_access(-7, -35, 20)) then
    raise exception 'Posição local foi rejeitada';
  end if;
  if not exists (select from public.get_club_access_status() where granted and expires_at is null) then
    raise exception 'Sessão local não foi liberada sem prazo de expiração';
  end if;
  if not exists (select from public.get_leaderboard() where points_balance = 100) then
    raise exception 'A participação local não apareceu no ranking';
  end if;

  perform set_config('request.jwt.claims', jsonb_build_object('sub', client_id, 'session_id', remote_session)::text, true);
  if public.has_club_access() or exists (select from public.get_leaderboard())
    or exists (select from public.barbers) or exists (select from public.appointments) then
    raise exception 'Outra sessão herdou o acesso local';
  end if;
  begin
    perform public.get_mural_notices();
    raise exception 'Mural acessível fora da região';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.get_available_slots(gen_random_uuid(), gen_random_uuid(), current_date);
    raise exception 'Horários acessíveis fora da região';
  exception when insufficient_privilege then null;
  end;

  reset role;

  perform set_config('request.jwt.claims', jsonb_build_object('sub', client_id, 'session_id', local_session)::text, true);
  if not public.has_club_access() then raise exception 'Acesso local expirou durante a sessão'; end if;

  if (select granted from public.verify_location_access(-8, -35, 20)) then
    raise exception 'Nova verificação fora da região recebeu acesso';
  end if;
  if public.has_club_access() then
    raise exception 'Nova verificação fora da região manteve o acesso local';
  end if;

  perform public.verify_location_access(-7, -35, 20);
  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', admin_id)::text, true);
  perform public.update_barbershop_location('Nova região', -8, -35, 10);
  perform set_config('request.jwt.claim.sub', client_id::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', client_id, 'session_id', local_session)::text, true);
  if public.has_club_access() then raise exception 'Sessão anterior à mudança de região ainda tem acesso'; end if;

  if not public.request_club_access() then raise exception 'Solicitação recusada'; end if;
  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', admin_id)::text, true);
  if not public.approve_club_access(client_id) then raise exception 'Aprovação falhou'; end if;

  perform set_config('request.jwt.claim.sub', client_id::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', client_id, 'session_id', remote_session)::text, true);
  if not exists (select from public.get_club_access_status() where granted and expires_at is null) then
    raise exception 'Aprovação administrativa não liberou a sessão remota';
  end if;
  reset role;
end;
$$;

rollback;
