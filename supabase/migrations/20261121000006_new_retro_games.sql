begin;

alter table public.game_sessions
  drop constraint game_sessions_game_code_check,
  add constraint game_sessions_game_code_check
    check (game_code in ('NAVALHA_RUSH', 'BARBA_FIGHTER', 'TORRE_FADE', 'ESCALADA_KONG', 'BIGODE_SNAKE', 'BARBER_VALLEY'));

alter table public.game_scores
  drop constraint game_scores_game_code_check,
  add constraint game_scores_game_code_check
    check (game_code in ('NAVALHA_RUSH', 'BARBA_FIGHTER', 'TORRE_FADE', 'ESCALADA_KONG', 'BIGODE_SNAKE', 'BARBER_VALLEY'));

create or replace function public.arcade_score_limit(p_game_code text, p_difficulty text)
returns integer
language sql immutable strict set search_path = ''
as $$
  select round(
    (case when p_game_code = 'TORRE_FADE' then 250
      when p_game_code = 'ESCALADA_KONG' then 350
      when p_game_code = 'BIGODE_SNAKE' then 400
      when p_game_code = 'BARBER_VALLEY' then 450
      when p_game_code = 'NAVALHA_RUSH' and p_difficulty = 'HARD' then 2000 else 400 end)
    * (case p_difficulty when 'HARD' then 2.5 when 'MEDIUM' then 1.5 else 1 end)
  )::integer;
$$;

create or replace function public.finish_arcade_run(
  p_client_id uuid, p_session_id uuid, p_score integer, p_ticks integer, p_engine_version integer, p_won boolean default false
)
returns table (score integer, points_awarded integer, points_balance integer, high_score integer, credited_today integer)
language plpgsql security definer set search_path = ''
as $$
declare
  run public.game_sessions%rowtype;
  saved public.game_scores%rowtype;
  finished_at timestamptz;
  today_brt date;
  award integer := 0;
  tick_limit integer;
  score_limit integer;
begin
  perform 1 from public.clients where clients.id = p_client_id for update;
  if not found then raise exception 'Perfil indisponível.' using errcode = '42501'; end if;

  select * into run from public.game_sessions where id = p_session_id and client_id = p_client_id;
  if not found or run.engine_version <> p_engine_version then
    raise exception 'Partida indisponível.' using errcode = '22023';
  end if;

  finished_at := clock_timestamp();
  today_brt := (finished_at at time zone 'America/Sao_Paulo')::date;
  select * into saved from public.game_scores where session_id = run.id;
  if not found then
    tick_limit := case
      when run.game_code = 'TORRE_FADE' and run.difficulty = 'HARD' then 1800
      when run.game_code = 'TORRE_FADE' and run.difficulty = 'MEDIUM' then 2700
      when run.game_code = 'ESCALADA_KONG' and run.difficulty = 'HARD' then 2700
      else 3600
    end;
    score_limit := public.arcade_score_limit(run.game_code, run.difficulty);
    if p_ticks is null or p_ticks not between 1 and tick_limit
      or p_score is null or p_score not between 0 and score_limit or p_won is null
      or finished_at - run.started_at > interval '10 minutes'
      or finished_at - run.started_at + interval '1 second' < make_interval(secs => p_ticks / 60.0)
    then
      raise exception 'Duração ou pontuação incompatível.' using errcode = '22023';
    end if;

    if p_score > 0 and (
      select count(*) from public.game_scores as daily
      where daily.client_id = p_client_id and daily.played_at = today_brt and daily.points_awarded > 0
    ) < 3 then
      award := p_score;
    end if;

    insert into public.game_scores (session_id, client_id, game_code, score, duration_seconds, points_awarded, played_at, difficulty, won)
    values (run.id, p_client_id, run.game_code, p_score, (p_ticks + 59) / 60, award, today_brt, run.difficulty, p_won)
    returning * into saved;

    if award > 0 then
      perform public.post_points(p_client_id, award, 'JOGO', 'Arcade: ' || run.game_code, run.id::text);
    end if;
  end if;

  return query select saved.score, saved.points_awarded, client.points_balance,
    (select max(best.score) from public.game_scores as best
      where best.client_id = p_client_id and best.game_code = run.game_code),
    (select count(*)::integer from public.game_scores as daily
      where daily.client_id = p_client_id and daily.played_at = today_brt and daily.points_awarded > 0)
  from public.clients as client where client.id = p_client_id;
end;
$$;

create or replace function public.get_arcade_stats()
returns table (game_code text, high_score integer, credited_today integer)
language sql stable security invoker set search_path = ''
as $$
  select games.code, coalesce(max(saved.score) filter (where saved.game_code = games.code), 0),
    count(saved.id) filter (
      where saved.played_at = (statement_timestamp() at time zone 'America/Sao_Paulo')::date and saved.points_awarded > 0
    )::integer
  from (values ('NAVALHA_RUSH'), ('BARBA_FIGHTER'), ('TORRE_FADE'),
    ('ESCALADA_KONG'), ('BIGODE_SNAKE'), ('BARBER_VALLEY')) as games(code)
  left join public.game_scores as saved on saved.client_id = (select auth.uid())
  group by games.code;
$$;

commit;
