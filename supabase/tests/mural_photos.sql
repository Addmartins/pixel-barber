-- Run on a migrated test database. This simulates Storage metadata; no image binaries are written.
begin;
do $$
declare
  admin_id uuid := gen_random_uuid();
  client_id uuid := gen_random_uuid();
  barber_photo text := gen_random_uuid()::text || '.jpg';
  photo_path text := admin_id::text || '/' || gen_random_uuid()::text || '.jpg';
  post_id uuid;
  notice_id uuid;
  meta jsonb := '{"avatar_skin":"fade","consent_terms":true,"consent_version":"2026-11-21-phone-preview"}';
begin
  insert into auth.users (id, phone, raw_user_meta_data) values
    (admin_id, '5581777700021', meta || '{"nome":"Gestor Mural"}'),
    (client_id, '5581777700022', meta || '{"nome":"Cliente Marcado","avatar_skin":"bigode"}');
  insert into public.club_admins values (admin_id);
  insert into public.club_members values (client_id);
  insert into public.barbers (nome, especialidade, foto_pixel)
  values ('Barbeiro Teste', 'Corte', 'https://test.example/storage/v1/object/public/barber-photos/' || barber_photo);
  insert into storage.objects (bucket_id, name) values ('barber-photos', barber_photo);
  if exists (select from storage.buckets where id = 'barber-photos' and public) then
    raise exception 'O bucket de fotos dos barbeiros está público';
  end if;

  perform set_config('request.jwt.claim.sub', client_id::text, true);
  set local role authenticated;
  begin
    perform public.find_mural_clients('Cliente');
    raise exception 'Cliente consultou lista de perfis';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into storage.objects (bucket_id, name)
    values ('club-mural', client_id::text || '/' || gen_random_uuid()::text || '.jpg');
    raise exception 'Cliente fez upload';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  if not exists (select 1 from public.find_mural_clients('Marcado') as c where c.id = client_id) then
    raise exception 'Busca administrativa não retornou o perfil';
  end if;
  insert into storage.objects (bucket_id, name) values ('club-mural', photo_path);
  perform set_config('request.jwt.claim.sub', client_id::text, true);
  if exists (select 1 from storage.objects where name = photo_path) then
    raise exception 'Rascunho ficou visível';
  end if;

  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  notice_id := public.publish_mural_notice('Primeiro aviso', 'Teste', '{}');
  perform public.publish_mural_notice('Segundo aviso', 'Teste', '{}');
  begin
    perform public.publish_mural_notice('Terceiro aviso', 'Teste', '{}');
    raise exception 'Terceiro aviso foi aceito';
  exception when sqlstate 'PT409' then null;
  end;
  post_id := public.publish_mural_notice('Corte da semana', 'Legenda', array[photo_path], client_id);
  delete from storage.objects where name = photo_path;
  if found then raise exception 'Storage permitiu apagar foto publicada'; end if;
  perform set_config('request.jwt.claim.sub', client_id::text, true);
  if (select count(*) from public.get_club_posts(false)) <> 2
    or (select count(*) from public.get_club_posts(true)) <> 1 then
    raise exception 'Quadro e portfólio não retornaram suas próprias publicações';
  end if;
  if not exists (select 1 from public.get_mural_notices()
    where id = post_id and body = 'Legenda' and tagged_name = 'Cliente' and tagged_avatar = 'bigode'
      and photo_paths = array[photo_path]) then
    raise exception 'Legenda, marcação ou foto não apareceu no mural';
  end if;
  if not exists (select 1 from storage.objects where name = photo_path) then
    raise exception 'Foto publicada não ficou visível';
  end if;
  if not exists (select 1 from storage.objects where name = barber_photo) then
    raise exception 'Foto do barbeiro não ficou visível para o membro';
  end if;

  reset role;
  delete from public.club_members where user_id = client_id;
  set local role authenticated;
  if exists (select from storage.objects where name in (photo_path, barber_photo))
    or exists (select from public.club_notices) then
    raise exception 'O cliente manteve acesso aos dados do mural após a revogação';
  end if;

  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  delete from public.club_notices where id = notice_id;
  perform public.publish_mural_notice('Aviso substituto', 'Teste', '{}');
  delete from public.club_notices where id = post_id;
  delete from storage.objects where name = photo_path;
  if not found then raise exception 'Foto órfã não pôde ser limpa'; end if;
  reset role;
end;
$$;
rollback;
