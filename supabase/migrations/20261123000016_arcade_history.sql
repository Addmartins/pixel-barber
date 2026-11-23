begin;

alter table public.game_scores add column display_score integer check (display_score >= 0);
create index game_scores_client_history_idx on public.game_scores (client_id, created_at desc, id desc);

create function public.finish_arcade_run_with_score(
  p_client_id uuid, p_session_id uuid, p_score integer, p_ticks integer,
  p_engine_version integer, p_won boolean, p_display_score integer
)
returns table (score integer, points_awarded integer, points_balance integer, high_score integer, credited_today integer)
language plpgsql security definer set search_path = ''
as $$
begin
  if p_display_score is null or p_display_score < 0 then
    raise exception 'Placar inválido.' using errcode = '22023';
  end if;
  return query select * from public.finish_arcade_run(
    p_client_id, p_session_id, p_score, p_ticks, p_engine_version, p_won
  );
  update public.game_scores as saved set display_score = p_display_score
  where saved.session_id = p_session_id and saved.client_id = p_client_id and saved.display_score is null;
end;
$$;

create function public.get_arcade_history(
  p_limit integer default 21, p_before_at timestamptz default null, p_before_id uuid default null
)
returns table (id uuid, game_code text, difficulty text, display_score integer, points_awarded integer,
  duration_seconds integer, created_at timestamptz, won boolean)
language sql stable security definer set search_path = ''
as $$
  select s.id,
    case when s.game_code = 'NAVALHA_RUSH' and run.engine_version in (5, 7, 9, 11)
      then 'ORBITA_PIXEL' else s.game_code end,
    s.difficulty, s.display_score, s.points_awarded, s.duration_seconds, s.created_at, s.won
  from public.game_scores s
  join public.game_sessions run on run.id = s.session_id
  where s.client_id = (select auth.uid())
    and (p_before_at is null or (s.created_at, s.id) < (p_before_at, p_before_id))
  order by s.created_at desc, s.id desc
  limit least(greatest(coalesce(p_limit, 21), 1), 51);
$$;

revoke all on function public.get_arcade_history(integer, timestamptz, uuid),
  public.finish_arcade_run_with_score(uuid, uuid, integer, integer, integer, boolean, integer)
  from public, anon, authenticated;
grant execute on function public.get_arcade_history(integer, timestamptz, uuid) to authenticated;
grant execute on function public.finish_arcade_run_with_score(uuid, uuid, integer, integer, integer, boolean, integer) to service_role;

commit;
