begin;

alter table public.store_products
  add column cosmetic_code text unique,
  add column cosmetic_slot text,
  add column rarity text,
  add constraint store_products_cosmetic_metadata_check check (
    (cosmetic_code is null and cosmetic_slot is null and rarity is null)
    or (
      categoria = 'ACESSORIO_AVATAR'
      and cosmetic_code is not null and btrim(cosmetic_code) <> ''
      and cosmetic_slot is not null and cosmetic_slot in ('head', 'body', 'face', 'tool')
      and rarity is not null and rarity in ('COMUM', 'RARO', 'LENDARIO')
    )
  );

insert into public.store_products
  (nome, categoria, preco_pontos, estoque, cosmetic_code, cosmetic_slot, rarity)
values
  ('Boné Snapback Pixel Barber', 'ACESSORIO_AVATAR', 150, 100, 'snapback', 'head', 'COMUM'),
  ('Boina Peaky Blinders', 'ACESSORIO_AVATAR', 300, 100, 'boina', 'head', 'RARO'),
  ('Óculos Escuros Aviador', 'ACESSORIO_AVATAR', 200, 100, 'aviador', 'face', 'COMUM'),
  ('Avental de Couro com Tesouras', 'ACESSORIO_AVATAR', 400, 100, 'avental', 'body', 'RARO'),
  ('Jaqueta Jeans Desfiada', 'ACESSORIO_AVATAR', 500, 100, 'jaqueta', 'body', 'RARO'),
  ('Navalha de Ouro Reluzente', 'ACESSORIO_AVATAR', 800, 100, 'navalha', 'tool', 'LENDARIO'),
  ('Bandana Quadriculada', 'ACESSORIO_AVATAR', 100, 100, 'bandana', 'head', 'COMUM'),
  ('Tesoura Cromada', 'ACESSORIO_AVATAR', 250, 100, 'tesoura', 'tool', 'RARO');

create table public.client_inventory (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  product_id uuid not null references public.store_products(id) on delete cascade,
  is_equipped boolean not null default false,
  acquired_at timestamptz not null default now(),
  unique (client_id, product_id)
);

create index idx_inventory_client on public.client_inventory(client_id);
create index idx_inventory_product on public.client_inventory(product_id);

alter table public.client_inventory enable row level security;
revoke all on table public.client_inventory from public, anon, authenticated;
grant select on table public.client_inventory to authenticated;
create policy inventory_read_own on public.client_inventory for select to authenticated
using (client_id = (select auth.uid()));

create function public.equip_avatar_item(p_product_id uuid, p_equipped boolean)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  slot_name text;
begin
  perform 1 from public.clients as owner where owner.id = owner_id for update;
  if not found then
    raise exception 'Perfil indisponível.' using errcode = '42501';
  end if;

  if p_equipped is null then
    raise exception 'Informe se o item deve ser equipado.' using errcode = '22023';
  end if;

  select product.cosmetic_slot into slot_name
  from public.client_inventory as item
  join public.store_products as product on product.id = item.product_id
  where item.client_id = owner_id and item.product_id = p_product_id
    and product.categoria = 'ACESSORIO_AVATAR' and product.cosmetic_code is not null;

  if not found then
    raise exception 'Item não adquirido.' using errcode = 'PT404';
  end if;

  if p_equipped then
    update public.client_inventory as item set is_equipped = false
    from public.store_products as product
    where product.id = item.product_id and product.cosmetic_slot = slot_name
      and item.client_id = owner_id and item.product_id <> p_product_id and item.is_equipped;
  end if;

  update public.client_inventory as item set is_equipped = p_equipped
  where item.client_id = owner_id and item.product_id = p_product_id;
  return p_equipped;
end;
$$;

create function public.buy_avatar_item(p_product_id uuid)
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

  return query select balance - product.preco_pontos;
end;
$$;

drop function public.get_leaderboard(integer, integer);
create function public.get_leaderboard(p_limit integer default 50, p_offset integer default 0)
returns table (
  "position" bigint, display_name text, avatar_skin text, points_balance integer,
  mastered_games text[], equipped_cosmetics text[]
)
language sql stable security definer set search_path = ''
as $$
  select
    row_number() over (order by member.points_balance desc, member.id) as "position",
    split_part(btrim(regexp_replace(member.nome, '[[:space:]]+', ' ', 'g')), ' ', 1) as display_name,
    member.avatar_skin,
    member.points_balance,
    array(
      select distinct achievement.game_code from public.game_scores as achievement
      where achievement.client_id = member.id and achievement.difficulty = 'HARD' and achievement.won
      order by achievement.game_code
    ),
    array(
      select product.cosmetic_code
      from public.client_inventory as item
      join public.store_products as product on product.id = item.product_id
      where item.client_id = member.id and item.is_equipped and product.cosmetic_code is not null
      order by product.cosmetic_slot, product.cosmetic_code
    )
  from public.clients as member
  where (select auth.uid()) is not null
  order by "position"
  limit least(greatest(coalesce(p_limit, 50), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all on function public.buy_avatar_item(uuid), public.equip_avatar_item(uuid, boolean),
  public.get_leaderboard(integer, integer) from public, anon, authenticated;
grant execute on function public.buy_avatar_item(uuid), public.equip_avatar_item(uuid, boolean),
  public.get_leaderboard(integer, integer) to authenticated;

commit;
