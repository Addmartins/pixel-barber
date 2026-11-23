-- Run on a migrated test database. Fixtures are rolled back.
begin;
do $$
declare
  buyer uuid := gen_random_uuid();
  peer uuid := gen_random_uuid();
  snap uuid;
  boina uuid;
  navalha uuid;
  physical_item uuid;
  out_of_stock uuid;
begin
  insert into auth.users(id, phone, raw_user_meta_data) values
  (buyer, '5581111111111', '{"nome":"Loja Tester","avatar_skin":"fade","consent_terms":true,"consent_version":"2026-11-21-phone-preview"}'),
  (peer, '5581222222222', '{"nome":"Loja Peer","avatar_skin":"fade","consent_terms":true,"consent_version":"2026-11-21-phone-preview"}');
  perform public.post_points(buyer, 500, 'CORTE', 'Fixture saldo da loja', 'fixture-loja');
  select id into strict snap from public.store_products where cosmetic_code = 'snapback';
  select id into strict boina from public.store_products where cosmetic_code = 'boina';
  select id into strict navalha from public.store_products where cosmetic_code = 'navalha';
  insert into public.store_products (nome, categoria, preco_reais, estoque)
  values ('Fixture bebida', 'BEBIDA', 5, 1) returning id into physical_item;
  update public.store_products set estoque = 0 where cosmetic_code = 'bandana' returning id into out_of_stock;
  if has_function_privilege('anon', 'public.buy_avatar_item(uuid)', 'EXECUTE')
    or has_table_privilege('authenticated', 'public.client_inventory', 'INSERT') then
    raise exception 'Unauthenticated redemption or direct inventory write granted';
  end if;
  perform set_config('request.jwt.claim.sub', buyer::text, true);
  set local role authenticated;
  if (select points_balance from public.buy_avatar_item(snap)) <> 350 then raise exception 'Wrong debit'; end if;
  if public.equip_avatar_item(snap, false) then raise exception 'Unexpected equip state'; end if;
  if (select points_balance from public.buy_avatar_item(snap)) <> 350 then raise exception 'Duplicate debit'; end if;
  if exists(select 1 from public.client_inventory where is_equipped) then raise exception 'Retry re-equipped'; end if;
  if not public.equip_avatar_item(snap, true) then raise exception 'Equip failed'; end if;
  if (select points_balance from public.buy_avatar_item(boina)) <> 50 then raise exception 'Second debit failed'; end if;
  if (select count(*) from public.client_inventory where is_equipped) <> 1 then raise exception 'Slot conflict'; end if;
  if (select equipped_cosmetics from public.get_leaderboard() where display_name='Loja' and points_balance=500) is distinct from array['boina'] then raise exception 'Ranking mismatch'; end if;
  begin
    perform public.buy_avatar_item(navalha);
    raise exception 'Insufficient points accepted';
  exception when sqlstate 'PT422' then null;
  end;
  begin
    perform public.buy_avatar_item(physical_item);
    raise exception 'Physical item accepted by points store';
  exception when sqlstate 'PT404' then null;
  end;
  begin
    perform public.buy_avatar_item(out_of_stock);
    raise exception 'Out of stock item accepted';
  exception when sqlstate 'PT409' then null;
  end;
  if (select count(*) from public.point_ledger where client_id=buyer and tipo='RESGATE_AVATAR') <> 2
    or (select sum(quantidade) from public.point_ledger where client_id=buyer and tipo='RESGATE_AVATAR') <> -450 then
    raise exception 'Ledger did not match the two successful redemptions';
  end if;
  perform set_config('request.jwt.claim.sub', peer::text, true);
  begin
    perform public.equip_avatar_item(snap, true);
    raise exception 'Peer equipped a product they do not own';
  exception when sqlstate 'PT404' then null;
  end;
  if exists(select 1 from public.client_inventory) then raise exception 'Peer saw inventory'; end if;
  reset role;
end;
$$;
rollback;
