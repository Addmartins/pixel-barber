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
  difficulty text;
  total_awarded integer := 0;
  final_score integer;
  game_ticks integer;
  metadata jsonb := '{"nome":"Arcade Teste","avatar_skin":"fade","consent_terms":true,"consent_version":"2026-11-21-phone-preview"}';
begin
  insert into auth.users (id, phone, raw_user_meta_data) values
    (player, '5581999000221', metadata), (opponent, '5581999000222', metadata);

  for i in 1..4 loop
    code := (array['NAVALHA_RUSH', 'BARBA_FIGHTER', 'TORRE_FADE', 'TORRE_FADE'])[i];
    difficulty := (array['EASY', 'MEDIUM', 'HARD', 'HARD'])[i];
    final_score := (array[151, 228, 383, 400])[i];
    game_ticks := case when difficulty = 'HARD' then 1800 else 2400 end;
    select id into strict run_id from public.start_arcade_run(player, code, 2, difficulty);
    if i = 1 then
      begin
        perform public.finish_arcade_run(player, run_id, 200, 2400, 2, false);
        raise exception 'Accepted an implausibly fast submission';
      exception when invalid_parameter_value then null;
      end;
      begin
        perform public.finish_arcade_run(opponent, run_id, 200, 2400, 2, false);
        raise exception 'Accepted a session belonging to another user';
      exception when invalid_parameter_value then null;
      end;
    end if;
    update public.game_sessions set started_at = clock_timestamp() - interval '60 seconds' where id = run_id;
    if difficulty = 'HARD' then
      begin
        perform public.finish_arcade_run(player, run_id, 626, game_ticks, 2, true);
        raise exception 'Accepted a score over the multiplied Tower cap';
      exception when invalid_parameter_value then null;
      end;
      begin
        perform public.finish_arcade_run(player, run_id, 400, game_ticks + 1, 2, true);
        raise exception 'Accepted a Hard Tower round over 30 seconds';
      exception when invalid_parameter_value then null;
      end;
    end if;
    select * into strict result from public.finish_arcade_run(player, run_id, final_score, game_ticks, 2, i = 4);
    total_awarded := total_awarded + result.points_awarded;
    if result.points_awarded <> (case when i < 4 then final_score else 0 end) or
       result.credited_today <> least(i, 3) then
      raise exception 'Incorrect daily credit on run %', i;
    end if;
  end loop;
  if result.high_score <> 400 or result.points_balance <> 762 then
    raise exception 'The fourth run must count toward the record only';
  end if;
  select * into strict result from public.finish_arcade_run(player, run_id, 100, 60, 2, false);
  if result.score <> 400 or result.points_balance <> total_awarded or
     (select count(*) from public.point_ledger where client_id = player and tipo = 'JOGO') <> 3 then
    raise exception 'Retry must return the saved score and preserve ledger and balance';
  end if;

  if has_function_privilege('authenticated', 'public.finish_arcade_run(uuid,uuid,integer,integer,integer,boolean)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.start_arcade_run(uuid,text,integer,text)', 'EXECUTE')
     or has_table_privilege('authenticated', 'public.game_scores', 'INSERT') then
    raise exception 'Untrusted role can write a score or issue credentials';
  end if;
  perform set_config('request.jwt.claim.sub', player::text, true);
  set local role authenticated;
  if (select credited_today from public.get_arcade_stats() where game_code = 'TORRE_FADE') <> 3
     or (select high_score from public.get_arcade_stats() where game_code = 'TORRE_FADE') <> 400
     or not exists (select 1 from public.get_leaderboard() where points_balance = 762 and mastered_games = array['TORRE_FADE']) then
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
