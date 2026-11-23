begin;

alter table public.store_products add column if not exists redemption_ends_at timestamptz;

update public.store_products
set redemption_ends_at = now() + interval '2160 hours'
where rarity = 'EXCLUSIVO' and redemption_ends_at is null;

create or replace function public.buy_avatar_item(p_product_id uuid)
returns table (points_balance integer)
language plpgsql security definer set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  balance integer;
  product public.store_products%rowtype;
  purchase_id uuid := gen_random_uuid();
begin
  select owner.points_balance into balance
  from public.clients as owner where owner.id = owner_id for update;
  if not found then
    raise exception 'Perfil indisponível.' using errcode = '42501';
  end if;

  balance := public.expire_client_points(owner_id);

  if exists (select 1 from public.client_inventory as item
    where item.client_id = owner_id and item.product_id = p_product_id) then
    return query select balance;
    return;
  end if;

  select catalog.* into product from public.store_products as catalog
  where catalog.id = p_product_id and catalog.categoria = 'ACESSORIO_AVATAR'
    and catalog.cosmetic_code is not null and catalog.preco_pontos > 0
  for update;
  if not found then
    raise exception 'Item fora do catálogo.' using errcode = 'PT404';
  end if;
  if product.redemption_ends_at <= clock_timestamp() then
    raise exception 'Período de resgate encerrado.' using errcode = 'PT410';
  end if;
  if product.estoque < 1 then
    raise exception 'Item sem estoque.' using errcode = 'PT409';
  end if;
  if balance < product.preco_pontos then
    raise exception 'Saldo de pontos insuficiente.' using errcode = 'PT422';
  end if;

  perform public.post_points(owner_id, -product.preco_pontos, 'RESGATE_AVATAR',
    'Resgate: ' || product.nome, purchase_id::text);
  insert into public.client_inventory (id, client_id, product_id)
  values (purchase_id, owner_id, product.id);
  update public.store_products as catalog set estoque = catalog.estoque - 1
  where catalog.id = product.id;
  perform public.equip_avatar_item(product.id, true);

  return query select owner.points_balance from public.clients as owner where owner.id = owner_id;
end;
$$;

commit;
