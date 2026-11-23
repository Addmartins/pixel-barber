begin;

do $$
declare
  account_id uuid := gen_random_uuid();
  meta jsonb := '{"nome":"Conta Termos","avatar_skin":"fade","consent_terms":true,"consent_version":"2026-11-21-phone-preview","app_terms_version":"2026-11-23-termos"}';
begin
  insert into auth.users (id, phone, raw_user_meta_data)
  values (account_id, '5581777700041', meta);
  if not exists (select 1 from public.clients
    where id = account_id and consent_terms and consent_terms_at is not null and consent_version = '2026-11-23-termos') then
    raise exception 'O cadastro não registrou a versão dos termos.';
  end if;

  begin
    insert into auth.users (id, phone, raw_user_meta_data)
    values (gen_random_uuid(), '5581777700042', meta || '{"consent_terms":false}');
    raise exception 'O cadastro aceitou uma conta sem aceite.';
  exception when check_violation then null;
  end;
end;
$$;

rollback;
