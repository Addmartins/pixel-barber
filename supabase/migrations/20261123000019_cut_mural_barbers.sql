begin;

alter table public.club_notices
  add column barber_id uuid references public.barbers(id) on delete set null,
  add constraint club_notices_barber_on_albums
    check (barber_id is null or cardinality(photo_paths) > 0);

create index club_notices_cut_albums_by_barber
  on public.club_notices (barber_id, created_at desc, id desc)
  where cardinality(photo_paths) > 0;

grant update (foto_pixel) on public.barbers to authenticated;
grant update (barber_id) on public.club_notices to authenticated;
create policy club_notice_admin_assign_barber on public.club_notices for update to authenticated
  using ((select public.is_club_admin()) and cardinality(photo_paths) > 0)
  with check ((select public.is_club_admin()) and cardinality(photo_paths) > 0);

create function public.publish_cut_album(
  p_barber_id uuid, p_title text, p_caption text, p_photos text[], p_tagged_client uuid default null
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  album_id uuid;
begin
  if not public.is_club_admin() then raise exception 'Acesso restrito.' using errcode = '42501'; end if;
  if p_barber_id is null or coalesce(cardinality(p_photos), 0) = 0 then
    raise exception 'Selecione o barbeiro e adicione fotos.' using errcode = '22023';
  end if;
  album_id := public.publish_mural_notice(p_title, p_caption, p_photos, p_tagged_client);
  update public.club_notices set barber_id = p_barber_id where id = album_id;
  return album_id;
end;
$$;

create function public.get_cut_albums(p_barber_id uuid, p_limit integer default 3, p_offset integer default 0)
returns table (id uuid, title text, body text, photo_paths text[], created_at timestamptz,
  tagged_name text, tagged_avatar text)
language sql stable security definer set search_path = ''
as $$
  select n.id, n.title, n.body, n.photo_paths, n.created_at,
    split_part(btrim(regexp_replace(c.nome, '[[:space:]]+', ' ', 'g')), ' ', 1), c.avatar_skin
  from public.club_notices n
  left join public.clients c on c.id = n.tagged_client_id
  where (select auth.uid()) is not null and cardinality(n.photo_paths) > 0
    and n.barber_id is not distinct from p_barber_id
  order by n.created_at desc, n.id desc
  limit least(greatest(coalesce(p_limit, 3), 1), 21)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all on function public.publish_cut_album(uuid, text, text, text[], uuid) from public, anon, authenticated;
revoke all on function public.get_cut_albums(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.publish_cut_album(uuid, text, text, text[], uuid) to authenticated;
grant execute on function public.get_cut_albums(uuid, integer, integer) to authenticated;

commit;
