begin;

create table public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  game_code text not null check (game_code in ('NAVALHA_RUSH', 'BARBA_FIGHTER', 'TORRE_FADE')),
  seed integer not null check (seed > 0),
  engine_version integer not null check (engine_version > 0),
  started_at timestamptz not null default clock_timestamp()
);

create table public.game_scores (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.game_sessions(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  game_code text not null check (game_code in ('NAVALHA_RUSH', 'BARBA_FIGHTER', 'TORRE_FADE')),
  score integer not null check (score between 0 and case when game_code = 'TORRE_FADE' then 250 else 400 end),
  duration_seconds integer not null check (duration_seconds between 1 and 60),
  points_awarded integer not null check (points_awarded in (0, score)),
  played_at date not null default ((statement_timestamp() at time zone 'America/Sao_Paulo')::date),
  created_at timestamptz not null default clock_timestamp()
);

create index game_sessions_client_start on public.game_sessions (client_id, started_at desc);
create index idx_game_scores_client_day on public.game_scores (client_id, played_at);
create index game_scores_personal_best on public.game_scores (client_id, game_code, score desc);

alter table public.game_sessions enable row level security;
alter table public.game_scores enable row level security;
revoke all on public.game_sessions, public.game_scores from public, anon, authenticated;
grant select on public.game_scores to authenticated;
grant select on public.game_sessions to service_role;
create policy read_own_game_scores on public.game_scores for select to authenticated
  using (client_id = (select auth.uid()));

create function public.start_arcade_run(p_client_id uuid, p_game_code text, p_engine_version integer)
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
    insert into public.game_sessions as run (client_id, game_code, seed, engine_version, started_at)
    values (p_client_id, p_game_code, 1 + floor(random() * 2147483646)::integer, p_engine_version, issued_at)
    returning run.id, run.seed;
end;
$$;

create function public.finish_arcade_run(
  p_client_id uuid, p_session_id uuid, p_score integer, p_ticks integer, p_engine_version integer
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
    if p_ticks is null or p_ticks not between 1 and 3600
      or p_score is null or p_score not between 0 and (case when run.game_code = 'TORRE_FADE' then 250 else 400 end)
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

    insert into public.game_scores (session_id, client_id, game_code, score, duration_seconds, points_awarded, played_at)
    values (run.id, p_client_id, run.game_code, p_score, (p_ticks + 59) / 60, award, today_brt)
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

create function public.get_arcade_stats()
returns table (game_code text, high_score integer, credited_today integer)
language sql stable security invoker set search_path = ''
as $$
  select games.code, coalesce(max(saved.score) filter (where saved.game_code = games.code), 0),
    count(saved.id) filter (
      where saved.played_at = (statement_timestamp() at time zone 'America/Sao_Paulo')::date and saved.points_awarded > 0
    )::integer
  from (values ('NAVALHA_RUSH'), ('BARBA_FIGHTER'), ('TORRE_FADE')) as games(code)
  left join public.game_scores as saved on saved.client_id = (select auth.uid())
  group by games.code;
$$;

revoke all on function public.start_arcade_run(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.finish_arcade_run(uuid, uuid, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.get_arcade_stats() from public, anon, authenticated;
grant execute on function public.start_arcade_run(uuid, text, integer) to service_role;
grant execute on function public.finish_arcade_run(uuid, uuid, integer, integer, integer) to service_role;
grant execute on function public.get_arcade_stats() to authenticated;

commit;
