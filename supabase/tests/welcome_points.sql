-- Run on a migrated test database. Fixtures are rolled back.
begin;
do $$
declare
  signup_id uuid := gen_random_uuid();
begin
  insert into auth.users (id, phone, raw_user_meta_data)
  values (signup_id, '5581777700031',
    '{"nome":"Novo Cliente","avatar_skin":"fade","consent_terms":true,"consent_version":"2026-11-21-phone-preview"}');

  if (select points_balance from public.clients where id = signup_id) is distinct from 0 then
    raise exception 'Conta sem verificação recebeu pontos';
  end if;

  update auth.users set phone_confirmed_at = now() where id = signup_id;
  update auth.users set phone_confirmed_at = now() where id = signup_id;

  if (select points_balance from public.clients where id = signup_id) is distinct from 150 then
    raise exception 'Carteira de nova conta deve começar com 150 pontos';
  end if;

  if not exists (select from public.point_ledger where client_id = signup_id
    and quantidade = 150 and event_key = 'signup-welcome') then
    raise exception 'Crédito inicial ausente do extrato';
  end if;
end;
$$;
rollback;
