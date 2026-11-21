-- Run on a local database after applying migrations. Test data is rolled back.
begin;

do $$
declare
  client_a uuid := gen_random_uuid();
  client_b uuid := gen_random_uuid();
  barber_a uuid;
  barber_b uuid;
  haircut uuid;
  combo uuid;
  target_day date := (clock_timestamp() at time zone 'America/Sao_Paulo')::date + 1;
  local_start timestamptz := (target_day + time '09:00') at time zone 'America/Sao_Paulo';
  booking uuid;
  deadline_allowed uuid;
  deadline_blocked uuid;
  long_booking uuid;
  profile_metadata jsonb := '{"avatar_skin":"fade","consent_terms":true,"consent_version":"2026-11-21-phone-preview"}';
  slot_count integer;
  allowed boolean;
  top_result record;
  second_result record;
begin
  insert into auth.users (id, phone, raw_user_meta_data) values
    (client_a, '5590000010101', profile_metadata || '{"nome":"Sprint Dois Cliente A"}'),
    (client_b, '5590000010102', profile_metadata || '{"nome":"Teste Cliente B"}');
  update public.clients set points_balance = 101 where id = client_a;

  select id into strict barber_a from public.barbers where nome = 'Mestre Navalha' limit 1;
  select id into strict barber_b from public.barbers where nome = 'Du Corte' limit 1;
  select id into strict haircut from public.services where nome = 'Corte';
  select id into strict combo from public.services where nome = 'Combo';

  if has_function_privilege('anon', 'public.create_appointment(uuid,uuid,timestamptz)', 'EXECUTE')
    or has_function_privilege('anon', 'public.get_available_slots(uuid,uuid,date)', 'EXECUTE')
    or has_function_privilege('anon', 'public.get_leaderboard(integer,integer)', 'EXECUTE')
  then
    raise exception 'Anônimos não devem executar as RPCs da Sprint 2';
  end if;

  perform set_config('request.jwt.claim.sub', client_a::text, true);
  set local role authenticated;
  select count(*) into slot_count from public.get_available_slots(barber_a, haircut, target_day);
  if slot_count <> 20 then
    raise exception 'A agenda deve listar os 20 blocos de 09:00 a 18:30';
  end if;
  select available into strict allowed from public.get_available_slots(barber_a, haircut, target_day)
  where starts_at = local_start;
  if allowed is distinct from true then
    raise exception '09:00 deveria estar disponível no fuso de Brasília';
  end if;
  select available into strict allowed from public.get_available_slots(barber_a, combo, target_day)
  where starts_at = local_start + interval '9 hours 30 minutes';
  if allowed is distinct from false then
    raise exception 'Combo às 18:30 ultrapassa o fechamento às 19:00';
  end if;
  begin
    perform public.create_appointment(barber_a, haircut, local_start + interval '5 minutes');
    raise exception 'A RPC aceitou horário fora da grade';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.create_appointment(barber_a, combo, local_start + interval '9 hours 30 minutes');
    raise exception 'A RPC aceitou atendimento que ultrapassa o expediente';
  exception when invalid_parameter_value then null;
  end;
  begin
    insert into public.appointments (client_id, barber_id, service_id, starts_at, ends_at)
    values (client_a, barber_a, haircut, local_start, local_start + interval '30 minutes');
    raise exception 'Clientes não devem inserir diretamente em appointments';
  exception when insufficient_privilege then null;
  end;

  booking := public.create_appointment(barber_a, haircut, local_start);
  if not exists (select from public.appointments where id = booking and client_id = client_a
    and starts_at = local_start and ends_at = local_start + interval '30 minutes' and status = 'AGENDADO')
  then
    raise exception 'Agendamento não apareceu com o titular, horário e duração esperados';
  end if;

  perform set_config('request.jwt.claim.sub', client_b::text, true);
  if exists (select from public.appointments where id = booking) then
    raise exception 'Outro cliente conseguiu ler o agendamento';
  end if;
  select available into strict allowed from public.get_available_slots(barber_a, haircut, target_day)
  where starts_at = local_start;
  if allowed is distinct from false then
    raise exception 'O horário ocupado ainda aparece disponível para outro cliente';
  end if;
  begin
    perform public.create_appointment(barber_a, haircut, local_start);
    raise exception 'Horário duplicado aceito para o mesmo barbeiro';
  exception when exclusion_violation then null;
  end;
  if public.cancel_appointment(booking) is distinct from false then
    raise exception 'Outro cliente conseguiu cancelar o agendamento';
  end if;

  perform set_config('request.jwt.claim.sub', client_a::text, true);
  begin
    perform public.create_appointment(barber_b, haircut, local_start);
    raise exception 'Um cliente conseguiu se agendar em dois barbeiros ao mesmo tempo';
  exception when exclusion_violation then null;
  end;
  if public.cancel_appointment(booking) is distinct from true then
    raise exception 'O titular deve conseguir cancelar um agendamento futuro';
  end if;
  if public.cancel_appointment(booking) is distinct from false then
    raise exception 'O cancelamento deve funcionar uma única vez';
  end if;
  select available into strict allowed from public.get_available_slots(barber_a, haircut, target_day)
  where starts_at = local_start;
  if allowed is distinct from true then
    raise exception 'O cancelamento não liberou o horário';
  end if;

  long_booking := public.create_appointment(barber_a, combo, local_start);
  perform set_config('request.jwt.claim.sub', client_b::text, true);
  begin
    perform public.create_appointment(barber_a, haircut, local_start + interval '30 minutes');
    raise exception 'Um corte foi aceito com início durante outro atendimento';
  exception when exclusion_violation then null;
  end;
  perform public.create_appointment(barber_a, haircut, local_start + interval '1 hour');
  perform set_config('request.jwt.claim.sub', client_a::text, true);
  if public.cancel_appointment(long_booking) is distinct from true then
    raise exception 'O serviço mais longo deve respeitar a mesma regra de cancelamento';
  end if;

  reset role;
  -- Use independent barbers and clients to cover both sides of the cutoff
  -- regardless of the time of day. These fixtures bypass booking-hours rules.
  insert into public.appointments (client_id, barber_id, service_id, starts_at, ends_at)
  values (client_a, barber_a, haircut, clock_timestamp() + interval '15 minutes 5 seconds',
    clock_timestamp() + interval '45 minutes 5 seconds') returning id into deadline_allowed;
  insert into public.appointments (client_id, barber_id, service_id, starts_at, ends_at)
  values (client_b, barber_b, haircut, clock_timestamp() + interval '14 minutes 59 seconds',
    clock_timestamp() + interval '44 minutes 59 seconds') returning id into deadline_blocked;
  set local role authenticated;
  if public.cancel_appointment(deadline_allowed) is distinct from true then
    raise exception 'A RPC bloqueou o cancelamento com pouco mais de 15 minutos';
  end if;
  perform set_config('request.jwt.claim.sub', client_b::text, true);
  if public.cancel_appointment(deadline_blocked) is distinct from false then
    raise exception 'A RPC permitiu o cancelamento com menos de 15 minutos';
  end if;

  select * into strict top_result from public.get_leaderboard(1, 0);
  select * into strict second_result from public.get_leaderboard(1, 1);
  if top_result.display_name is distinct from 'Sprint' or top_result.points_balance <> 101
    or top_result."position" <> 1 or second_result."position" <> 2 then
    raise exception 'O ranking deve exibir o primeiro nome e preservar a posição global entre páginas';
  end if;
  if exists (select from public.clients where id = client_a) then
    raise exception 'O ranking não deve liberar leitura do perfil de terceiros';
  end if;
end;
$$;

rollback;
