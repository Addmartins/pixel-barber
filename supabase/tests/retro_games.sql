-- Run against a migrated test database. All fixtures are rolled back.
begin;
do $$
declare
  player uuid := gen_random_uuid();
  game text;
  run_id uuid;
  result record;
  codes text[] := array['ESCALADA_KONG', 'BIGODE_SNAKE', 'BARBER_VALLEY'];
  limits integer[] := array[875, 1000, 1125];
begin
  insert into auth.users (id, phone, raw_user_meta_data)
  values (player, '5581999000788',
    '{"nome":"Retro Tester","avatar_skin":"fade","consent_terms":true,"consent_version":"2026-11-21-phone-preview"}');
  for i in 1..4 loop
    game := codes[least(i, 3)];
    select id into strict run_id from public.start_arcade_run(player, game, 2, 'HARD');
    update public.game_sessions set started_at = clock_timestamp() - interval '60 seconds' where id = run_id;
    begin
      perform public.finish_arcade_run(player, run_id, limits[least(i, 3)] + 1, 1200, 2, true);
      raise exception 'Accepted a score above the cap for %', game;
    exception when invalid_parameter_value then null;
    end;
    if i = 1 then
      begin
        perform public.finish_arcade_run(player, run_id, 375, 2701, 2, true);
        raise exception 'Accepted a Mestre Escalada round over 45 seconds';
      exception when invalid_parameter_value then null;
      end;
    end if;
    select * into strict result from public.finish_arcade_run(player, run_id, limits[least(i, 3)], 1200, 2, true);
    if result.points_awarded <> (case when i <= 3 then limits[i] else 0 end) or
       result.credited_today <> least(i, 3) then
      raise exception 'Incorrect credit on %', game;
    end if;
  end loop;
  perform set_config('request.jwt.claim.sub', player::text, true);
  set local role authenticated;
  if (select count(*) from public.get_arcade_stats()) <> 6 or
    (select high_score from public.get_arcade_stats() where game_code = 'BARBER_VALLEY') <> 1125 or
    (select count(*) from public.point_ledger where client_id = player and tipo = 'JOGO') <> 3 then
    raise exception 'Expected six records, Barber Valley high score and three ledger entries';
  end if;
end;
$$;
rollback;
