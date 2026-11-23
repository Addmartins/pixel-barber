begin;

alter table public.club_notices
  add column photo_paths text[] not null default '{}' check (cardinality(photo_paths) <= 4),
  add column tagged_client_id uuid references public.clients(id) on delete set null;
alter table public.club_notices drop constraint club_notices_body_check,
  add constraint club_notices_content_check check (
    char_length(btrim(body)) <= 1000 and (btrim(body) <> '' or cardinality(photo_paths) > 0)
  );
create index club_notice_photos_idx on public.club_notices using gin (photo_paths);

revoke select, insert on public.club_notices from authenticated;
grant select (id, title, body, photo_paths, created_at) on public.club_notices to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('club-mural', 'club-mural', false, 6291456, array['image/jpeg','image/png','image/webp']);

create policy club_mural_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'club-mural' and (select public.is_club_admin())
    and split_part(name, '/', 1) = (select auth.uid())::text
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$');

create policy club_mural_read on storage.objects for select to authenticated
  using (bucket_id = 'club-mural' and (
    (select public.is_club_admin()) or exists (
      select 1 from public.club_notices n where n.photo_paths @> array[storage.objects.name]
    )
  ));

create policy club_mural_delete on storage.objects for delete to authenticated
  using (bucket_id = 'club-mural' and (select public.is_club_admin()) and not exists (
    select 1 from public.club_notices n where n.photo_paths @> array[storage.objects.name]
  ));

create function public.find_mural_clients(p_query text)
returns table (id uuid, nome text, avatar_skin text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_club_admin() then raise exception 'Acesso restrito.' using errcode = '42501'; end if;
  return query select c.id, c.nome, c.avatar_skin from public.clients c
  where char_length(btrim(p_query)) between 2 and 80
    and strpos(lower(c.nome), lower(btrim(p_query))) > 0
  order by c.nome, c.id limit 20;
end;
$$;

create function public.publish_mural_notice(p_title text, p_caption text, p_photos text[], p_tagged_client uuid default null)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  notice_id uuid;
begin
  if not public.is_club_admin() then raise exception 'Acesso restrito.' using errcode = '42501'; end if;
  if p_photos is null or cardinality(p_photos) > 4 or exists (
    select 1 from unnest(p_photos) path
    where split_part(path, '/', 1) is distinct from (select auth.uid())::text
      or not exists (select 1 from storage.objects o where o.bucket_id = 'club-mural' and o.name = path)
      or exists (select 1 from public.club_notices n where n.photo_paths @> array[path])
  ) then raise exception 'Fotos inválidas.' using errcode = '22023'; end if;
  insert into public.club_notices (title, body, photo_paths, tagged_client_id)
  values (btrim(p_title), btrim(p_caption), p_photos, p_tagged_client)
  returning id into notice_id;
  return notice_id;
end;
$$;

create function public.get_mural_notices()
returns table (id uuid, title text, body text, photo_paths text[], created_at timestamptz,
  tagged_name text, tagged_avatar text)
language sql stable security definer set search_path = ''
as $$
  select n.id, n.title, n.body, n.photo_paths, n.created_at,
    split_part(btrim(regexp_replace(c.nome, '[[:space:]]+', ' ', 'g')), ' ', 1), c.avatar_skin
  from public.club_notices n
  left join public.clients c on c.id = n.tagged_client_id
  where (select auth.uid()) is not null
  order by n.created_at desc, n.id desc limit 20;
$$;

revoke all on function public.find_mural_clients(text), public.publish_mural_notice(text, text, text[], uuid),
  public.get_mural_notices() from public, anon, authenticated;
grant execute on function public.find_mural_clients(text), public.publish_mural_notice(text, text, text[], uuid),
  public.get_mural_notices() to authenticated;

commit;
