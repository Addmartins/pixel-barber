begin;

alter table public.game_sessions
  add column difficulty text not null default 'EASY'
    check (difficulty in ('EASY', 'MEDIUM', 'HARD'));

alter table public.game_scores
  add column difficulty text not null default 'EASY'
    check (difficulty in ('EASY', 'MEDIUM', 'HARD')),
  add column won boolean not null default false;

create function public.arcade_score_limit(p_game_code text, p_difficulty text)
returns integer
language sql immutable strict set search_path = ''
as $$
  select round(
    (case when p_game_code = 'TORRE_FADE' then 250
      when p_game_code = 'NAVALHA_RUSH' and p_difficulty = 'HARD' then 2000 else 400 end)
    * (case p_difficulty when 'HARD' then 2.5 when 'MEDIUM' then 1.5 else 1 end)
  )::integer;
$$;

alter table public.game_scores
  drop constraint game_scores_check,
  add constraint game_scores_score_check
    check (score between 0 and public.arcade_score_limit(game_code, difficulty));

create index game_scores_mastered_games on public.game_scores (client_id, game_code)
  where difficulty = 'HARD' and won;

drop function public.start_arcade_run(uuid, text, integer);
drop function public.finish_arcade_run(uuid, uuid, integer, integer, integer);
drop function public.get_leaderboard(integer, integer);

create function public.start_arcade_run(p_client_id uuid, p_game_code text, p_engine_version integer, p_difficulty text default 'EASY')
returns table (id uuid, seed integer)
language plpgsql security definer set search_path = ''
as $$
declare
  issued_at timestamptz;
begin
  perform 1 from public.clients where clients.id = p_client_id for update;
  if not found then raise exception 'Perfil indisponível.' using errcode = '42501'; end if;

  issued_at := clock_timestamp();

  if exists (select 1 from public.game_sessions
    where client_id = p_client_id and started_at > issued_at - interval '2 seconds')
  then raise exception 'Aguarde antes de começar outra partida.' using errcode = 'P0001'; end if;

  delete from public.game_sessions as run
  where run.client_id = p_client_id and run.started_at < issued_at - interval '10 minutes'
    and not exists (select 1 from public.game_scores as saved where saved.session_id = run.id);

  return query
    insert into public.game_sessions as run (client_id, game_code, seed, engine_version, started_at, difficulty)
    values (p_client_id, p_game_code, 1 + floor(random() * 2147483646)::integer, p_engine_version, issued_at, p_difficulty)
    returning run.id, run.seed;
end;
$$;

create function public.finish_arcade_run(
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

create function public.get_leaderboard(p_limit integer default 50, p_offset integer default 0)
returns table ("position" bigint, display_name text, avatar_skin text, points_balance integer, mastered_games text[])
language sql stable security definer set search_path = ''
as $$
  select
    row_number() over (order by member.points_balance desc, member.id) as "position",
    split_part(btrim(regexp_replace(member.nome, '[[:space:]]+', ' ', 'g')), ' ', 1) as display_name,
    member.avatar_skin,
    member.points_balance,
    array(
      select distinct achievement.game_code from public.game_scores as achievement
      where achievement.client_id = member.id and achievement.difficulty = 'HARD' and achievement.won
      order by achievement.game_code
    )
  from public.clients as member
  where (select auth.uid()) is not null
  order by "position"
  limit least(greatest(coalesce(p_limit, 50), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all on function public.start_arcade_run(uuid, text, integer, text) from public, anon, authenticated;
revoke all on function public.finish_arcade_run(uuid, uuid, integer, integer, integer, boolean) from public, anon, authenticated;
revoke all on function public.get_leaderboard(integer, integer) from public, anon, authenticated;
grant execute on function public.start_arcade_run(uuid, text, integer, text) to service_role;
grant execute on function public.finish_arcade_run(uuid, uuid, integer, integer, integer, boolean) to service_role;
grant execute on function public.get_leaderboard(integer, integer) to authenticated;

commit;
