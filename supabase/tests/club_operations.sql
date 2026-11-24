-- Run on a migrated test database. Fixtures are rolled back.
begin;

do $$
declare
  admin_id uuid := gen_random_uuid();
  client_id uuid := gen_random_uuid();
  other_id uuid := gen_random_uuid();
  barber_id uuid;
  service_id uuid;
  bookings uuid[] := array[gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()];
  week_at timestamptz := public.club_week_start(statement_timestamp()) - interval '336 hours';
  credits uuid;
  current_booking uuid := gen_random_uuid();
  admin_cancelled_booking uuid;
  cancellation_start timestamptz := clock_timestamp() + interval '5 minutes';
  meta jsonb := '{"avatar_skin":"fade","consent_terms":true,"consent_version":"2026-11-21-phone-preview"}';
begin
  insert into auth.users (id, phone, raw_user_meta_data) values
    (admin_id, '5581777700011', meta || '{"nome":"Gestão Teste"}'),
    (client_id, '5581777700012', meta || '{"nome":"Operação Teste"}'),
    (other_id, '5581777700013', meta || '{"nome":"Outro Teste"}');
  insert into public.club_admins values (admin_id);
  insert into public.club_members values (client_id), (other_id);
  select id into strict service_id from public.services where nome = 'Corte';

  perform set_config('request.jwt.claim.sub', client_id::text, true);
  set local role authenticated;
  if public.is_club_admin() then raise exception 'Cliente ganhou acesso administrativo'; end if;
  begin
    perform public.get_club_metrics();
    raise exception 'Métricas expostas a cliente';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.publish_mural_notice('Aviso', 'Inválido', '{}');
    raise exception 'Cliente publicou aviso';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.barbers (nome, especialidade) values ('Inválido', 'Teste');
    raise exception 'Cliente cadastrou barbeiro';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.club_suggestions (client_id, body) values (other_id, 'Inválida');
    raise exception 'Cliente enviou sugestão por outro usuário';
  exception when insufficient_privilege then null;
  end;
  insert into public.club_suggestions (client_id, body) values (client_id, 'Sugestão de teste');
  if exists (select 1 from public.club_suggestions) then raise exception 'Sugestões expostas a cliente'; end if;

  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  if not public.is_club_admin() then raise exception 'Administrador sem acesso'; end if;
  insert into public.barbers (nome, especialidade) values ('Barbeiro Teste', 'Corte') returning id into barber_id;
  update public.barbers set endereco = 'Rua do Teste, 10' where id = barber_id;
  perform set_config('request.jwt.claim.sub', client_id::text, true);
  if (select endereco from public.barbers where id = barber_id) is distinct from 'Rua do Teste, 10' then
    raise exception 'Endereço indisponível para o agendamento';
  end if;
  update public.barbers set endereco = null where id = barber_id;
  if found then raise exception 'Cliente alterou endereço de barbeiro'; end if;
  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  update public.barbers set endereco = null where id = barber_id;
  if not found then raise exception 'Administrador não removeu endereço de barbeiro'; end if;
  perform public.publish_mural_notice('Aviso', 'Teste', '{}');
  if (select pending_suggestions from public.get_club_metrics()) <> 1 then raise exception 'Métrica de sugestões incorreta'; end if;
  update public.club_suggestions set reviewed_at = now() where body = 'Sugestão de teste';
  if (select pending_suggestions from public.get_club_metrics()) <> 0 then raise exception 'Sugestão não revisada'; end if;
  reset role;

  insert into public.appointments (id, client_id, barber_id, service_id, starts_at, ends_at)
  select booking, client_id, barber_id, service_id, week_at + elapsed, week_at + elapsed + interval '30 minutes'
  from unnest(bookings, array[interval '10 hours', interval '11 hours', interval '12 hours',
    interval '178 hours', interval '179 hours', interval '180 hours']) as fixture(booking, elapsed);
  credits := public.post_points(client_id, 100, 'JOGO', 'Semana anterior', 'club-past');
  update public.point_ledger set created_at = week_at + interval '1 hour' where id = credits;
  credits := public.post_points(client_id, 100, 'JOGO', 'Semana seguinte', 'club-next');
  update public.point_ledger set created_at = week_at + interval '169 hours' where id = credits;
  perform public.post_points(client_id, 200, 'JOGO', 'Semana atual', 'club-now');
  perform public.post_points(client_id, -30, 'RESGATE_AVATAR', 'Resgate de teste', 'club-redeem');

  set local role authenticated;
  if (select count(*) from public.get_club_appointments((week_at at time zone 'America/Recife')::date)) <> 3 then
    raise exception 'Agenda administrativa incompleta';
  end if;
  begin
    perform public.set_club_attendance(bookings[2], 'NO_SHOW');
    raise exception 'Falta registrada fora de ordem';
  exception when sqlstate 'PT409' then null;
  end;
  if not public.set_club_attendance(bookings[1], 'NO_SHOW')
    or not public.set_club_attendance(bookings[2], 'NO_SHOW')
    or not public.set_club_attendance(bookings[3], 'NO_SHOW')
    or not public.set_club_attendance(bookings[4], 'NO_SHOW')
    or not public.set_club_attendance(bookings[5], 'CONCLUIDO')
    or not public.set_club_attendance(bookings[6], 'NO_SHOW')
    or public.set_club_attendance(bookings[1], 'NO_SHOW') then
    raise exception 'Registro ou idempotência da presença incorretos';
  end if;

  perform set_config('request.jwt.claim.sub', client_id::text, true);
  if not exists (select 1 from public.club_notices where title = 'Aviso') then raise exception 'Aviso ausente no mural'; end if;
  if (select points_balance from public.get_leaderboard() where display_name = 'Operação') is distinct from 200 then
    raise exception 'Ranking aplicou gasto ou pontos de outra semana';
  end if;
  reset role;

  if (select array_agg(applied_percent order by ordinality)
      from unnest(bookings) with ordinality as fixture(booking, ordinality)
      join public.appointment_penalties on appointment_id = booking)
      is distinct from array[20, 30, 0, 50, 0] then
    raise exception 'Progressão e teto semanal incorretos';
  end if;
  if not exists (select 1 from public.clients where id = client_id and points_balance = 270) then
    raise exception 'Saldo após penalidades incorreto';
  end if;

  insert into public.appointments (id, client_id, barber_id, service_id, starts_at, ends_at)
  values (current_booking, client_id, barber_id, service_id, week_at + interval '336 hours',
    week_at + interval '336 hours 1 microsecond');
  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  set local role authenticated;
  if not public.set_club_attendance(current_booking, 'NO_SHOW') then raise exception 'Falta da semana atual não registrada'; end if;
  perform set_config('request.jwt.claim.sub', client_id::text, true);
  if (select points_balance from public.get_leaderboard() where display_name = 'Operação') is distinct from 140 then
    raise exception 'Ranking não deduziu a falta desta semana ou a presença não reiniciou a sequência';
  end if;
  reset role;

  credits := public.post_points(other_id, 100, 'JOGO', 'Crédito mais antigo', 'club-fifo-old');
  perform public.post_points(other_id, 60, 'JOGO', 'Crédito recente', 'club-fifo-new');
  perform public.post_points(other_id, -30, 'RESGATE_AVATAR', 'Resgate FIFO', 'club-fifo-debit');
  update public.point_ledger set created_at = now() - interval '91 days' where id = credits;

  perform set_config('request.jwt.claim.sub', other_id::text, true);
  set local role authenticated;
  if public.get_current_points_balance() <> 60 then raise exception 'Expiração FIFO incorreta'; end if;
  if public.get_current_points_balance() <> 60 then raise exception 'Saldo mudou na repetição da expiração'; end if;
  if (select count(*) from public.point_ledger where tipo = 'EXPIRACAO' and quantidade = -70) <> 1 then
    raise exception 'Débito de expiração ausente ou duplicado';
  end if;
  if (select points_balance from public.get_leaderboard() where display_name = 'Outro') is distinct from 60 then
    raise exception 'Expiração afetou a classificação';
  end if;
  reset role;

  insert into public.appointments (client_id, barber_id, service_id, starts_at, ends_at)
  values (client_id, barber_id, service_id, cancellation_start, cancellation_start + interval '30 minutes')
  returning id into admin_cancelled_booking;
  perform set_config('request.jwt.claim.sub', client_id::text, true);
  set local role authenticated;
  begin
    perform public.cancel_club_appointment(admin_cancelled_booking);
    raise exception 'Cliente executou cancelamento administrativo';
  exception when insufficient_privilege then null;
  end;
  if public.cancel_appointment(admin_cancelled_booking) then
    raise exception 'Cancelamento pelo cliente ignorou o prazo';
  end if;

  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  if not public.cancel_club_appointment(admin_cancelled_booking)
    or public.cancel_club_appointment(admin_cancelled_booking)
    or public.cancel_club_appointment(current_booking)
    or public.cancel_club_appointment(bookings[5]) then
    raise exception 'Cancelamento administrativo aceitou um estado inválido ou não cancelou';
  end if;
  perform set_config('request.jwt.claim.sub', client_id::text, true);
  if not exists (select from public.appointments
    where id = admin_cancelled_booking and status = 'CANCELADO' and cancelled_at is not null) then
    raise exception 'Cancelamento não ficou visível ao cliente';
  end if;
  reset role;
  if exists (select from public.appointment_penalties where appointment_id = admin_cancelled_booking) then
    raise exception 'Cancelamento administrativo gerou penalidade';
  end if;
  insert into public.appointments (client_id, barber_id, service_id, starts_at, ends_at)
  values (other_id, barber_id, service_id, cancellation_start, cancellation_start + interval '30 minutes');
end;
$$;

rollback;
