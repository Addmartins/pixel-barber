-- Run on a freshly migrated test database. Fixtures are rolled back.
begin;
do $$
declare
  player uuid := gen_random_uuid();
  opponent uuid := gen_random_uuid();
  run_id uuid;
  i integer;
  result record;
  code text;
  metadata jsonb := '{"nome":"Arcade Teste","avatar_skin":"fade","consent_terms":true,"consent_version":"2026-11-21-phone-preview"}';
begin
  insert into auth.users (id, phone, raw_user_meta_data) values
    (player, '5581999000221', metadata), (opponent, '5581999000222', metadata);

  for i in 1..4 loop
    code := (array['NAVALHA_RUSH', 'BARBA_FIGHTER', 'TORRE_FADE', 'TORRE_FADE'])[i];
    select id into strict run_id from public.start_arcade_run(player, code, 1);
    if i = 1 then
      begin
        perform public.finish_arcade_run(player, run_id, 200, 2400, 1);
        raise exception 'Accepted an implausibly fast submission';
      exception when invalid_parameter_value then null;
      end;
      begin
        perform public.finish_arcade_run(opponent, run_id, 200, 2400, 1);
        raise exception 'Accepted a session belonging to another user';
      exception when invalid_parameter_value then null;
      end;
    end if;
    update public.game_sessions set started_at = clock_timestamp() - interval '60 seconds' where id = run_id;
    select * into strict result from public.finish_arcade_run(player, run_id, 150 + i, 2400, 1);
    if result.points_awarded <> (case when i < 4 then 150 + i else 0 end) or
       result.credited_today <> least(i, 3) then
      raise exception 'Incorrect daily credit on run %', i;
    end if;
  end loop;
  if result.high_score <> 154 or result.points_balance <> 456 then
    raise exception 'The fourth run must count toward the record only';
  end if;
  select * into strict result from public.finish_arcade_run(player, run_id, 100, 60, 1);
  if result.score <> 154 or result.points_balance <> 456 or
     (select count(*) from public.point_ledger where client_id = player and tipo = 'JOGO') <> 3 then
    raise exception 'Retry must return the saved score and preserve ledger and balance';
  end if;

  if has_function_privilege('authenticated', 'public.finish_arcade_run(uuid,uuid,integer,integer,integer)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.start_arcade_run(uuid,text,integer)', 'EXECUTE')
     or has_table_privilege('authenticated', 'public.game_scores', 'INSERT') then
    raise exception 'Untrusted role can write a score or issue credentials';
  end if;
  perform set_config('request.jwt.claim.sub', player::text, true);
  set local role authenticated;
  if (select credited_today from public.get_arcade_stats() where game_code = 'TORRE_FADE') <> 3
     or (select high_score from public.get_arcade_stats() where game_code = 'TORRE_FADE') <> 154
     or not exists (select 1 from public.get_leaderboard() where points_balance = 456) then
    raise exception 'Authenticated stats or ranking did not include updated results';
  end if;
  perform set_config('request.jwt.claim.sub', opponent::text, true);
  if exists (select 1 from public.game_scores) or exists (select 1 from public.get_arcade_stats() where high_score <> 0) then
    raise exception 'Another user can read private game scores';
  end if;
  reset role;
end;
$$;
rollback;
