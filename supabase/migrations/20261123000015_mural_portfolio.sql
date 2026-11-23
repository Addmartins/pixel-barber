begin;

alter table public.club_notices
  add column active_slot smallint unique
  check (active_slot is null or (active_slot in (1, 2) and cardinality(photo_paths) = 0));

-- Keep the two latest text notices active. Older notices remain in the database.
with recent as (
  select id, row_number() over (order by created_at desc, id desc)::smallint as slot
  from public.club_notices where cardinality(photo_paths) = 0
  order by created_at desc, id desc limit 2
)
update public.club_notices n set active_slot = recent.slot from recent where n.id = recent.id;

create or replace function public.publish_mural_notice(p_title text, p_caption text, p_photos text[], p_tagged_client uuid default null)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  notice_id uuid;
  notice_slot smallint;
begin
  if not public.is_club_admin() then raise exception 'Acesso restrito.' using errcode = '42501'; end if;
  if p_photos is null or cardinality(p_photos) > 4 or exists (
    select 1 from unnest(p_photos) path
    where split_part(path, '/', 1) is distinct from (select auth.uid())::text
      or not exists (select 1 from storage.objects o where o.bucket_id = 'club-mural' and o.name = path)
      or exists (select 1 from public.club_notices n where n.photo_paths @> array[path])
  ) then raise exception 'Fotos inválidas.' using errcode = '22023'; end if;
  if cardinality(p_photos) = 0 then
    perform pg_advisory_xact_lock(hashtextextended('pixel-barber:club-notice-slots', 0));
    select slot into notice_slot from generate_series(1, 2) as slot
    where not exists (select 1 from public.club_notices where active_slot = slot)
    order by slot limit 1;
    if notice_slot is null then
      raise exception 'O quadro já tem dois avisos. Remova um antes de publicar outro.' using errcode = 'PT409';
    end if;
  end if;
  insert into public.club_notices (title, body, photo_paths, tagged_client_id, active_slot)
  values (btrim(p_title), btrim(p_caption), p_photos, p_tagged_client, notice_slot)
  returning id into notice_id;
  return notice_id;
end;
$$;

create or replace function public.get_mural_notices()
returns table (id uuid, title text, body text, photo_paths text[], created_at timestamptz,
  tagged_name text, tagged_avatar text)
language sql stable security definer set search_path = ''
as $$
  select n.id, n.title, n.body, n.photo_paths, n.created_at,
    split_part(btrim(regexp_replace(c.nome, '[[:space:]]+', ' ', 'g')), ' ', 1), c.avatar_skin
  from public.club_notices n
  left join public.clients c on c.id = n.tagged_client_id
  where (select auth.uid()) is not null and (n.active_slot is not null or cardinality(n.photo_paths) > 0)
  order by n.created_at desc, n.id desc limit 20;
$$;

create function public.get_club_posts(p_portfolio boolean, p_limit integer default 4, p_offset integer default 0)
returns table (id uuid, title text, body text, photo_paths text[], created_at timestamptz,
  tagged_name text, tagged_avatar text)
language sql stable security definer set search_path = ''
as $$
  select n.id, n.title, n.body, n.photo_paths, n.created_at,
    split_part(btrim(regexp_replace(c.nome, '[[:space:]]+', ' ', 'g')), ' ', 1), c.avatar_skin
  from public.club_notices n
  left join public.clients c on c.id = n.tagged_client_id
  where (select auth.uid()) is not null
    and case when p_portfolio then cardinality(n.photo_paths) > 0 else n.active_slot is not null end
  order by n.created_at desc, n.id desc
  limit least(greatest(coalesce(p_limit, 4), 1), 21)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all on function public.get_club_posts(boolean, integer, integer) from public, anon, authenticated;
grant execute on function public.get_club_posts(boolean, integer, integer) to authenticated;

commit;
