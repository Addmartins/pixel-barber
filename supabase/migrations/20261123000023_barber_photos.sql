begin;

grant insert (foto_pixel) on public.barbers to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('barber-photos', 'barber-photos', true, 6291456, array['image/jpeg', 'image/png', 'image/webp']);

create policy barber_photos_admin_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'barber-photos' and (select public.is_club_admin())
    and name ~ '^[0-9a-f-]{36}\.(jpg|png|webp)$');

create policy barber_photos_admin_read on storage.objects for select to authenticated
  using (bucket_id = 'barber-photos' and (select public.is_club_admin()));

create policy barber_photos_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'barber-photos' and (select public.is_club_admin()) and not exists (
    select 1 from public.barbers b
    where pg_catalog.right(b.foto_pixel, pg_catalog.length('/storage/v1/object/public/barber-photos/' || storage.objects.name))
      = '/storage/v1/object/public/barber-photos/' || storage.objects.name
  ));

commit;
