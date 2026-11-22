begin;

alter table public.client_inventory
  add column shirt_number integer check (shirt_number between 0 and 99);

update public.store_products
set nome = 'Camisa do River Plate · número personalizável'
where cosmetic_code = 'camisa_river';

create function public.set_avatar_shirt_number(p_number integer)
returns integer
language plpgsql security definer set search_path = ''
as $$
begin
  if p_number is null or p_number not between 0 and 99 then
    raise exception 'Informe um número de 0 a 99.' using errcode = '22023';
  end if;

  update public.client_inventory as item
  set shirt_number = p_number
  from public.store_products as product
  where item.client_id = (select auth.uid())
    and item.product_id = product.id and product.cosmetic_code = 'camisa_river';

  if not found then
    raise exception 'Camisa não adquirida.' using errcode = 'PT404';
  end if;
  return p_number;
end;
$$;

drop function public.get_leaderboard(integer, integer);
create function public.get_leaderboard(p_limit integer default 50, p_offset integer default 0)
returns table (
  "position" bigint, display_name text, avatar_skin text, points_balance integer,
  mastered_games text[], equipped_cosmetics text[], shirt_number integer
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
    ),
    shirt.shirt_number
  from public.clients as member
  left join lateral (
    select item.shirt_number
    from public.client_inventory as item
    join public.store_products as product on product.id = item.product_id
    where item.client_id = member.id and item.is_equipped and product.cosmetic_code = 'camisa_river'
  ) as shirt on true
  where (select auth.uid()) is not null
  order by "position"
  limit least(greatest(coalesce(p_limit, 50), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all on function public.set_avatar_shirt_number(integer), public.get_leaderboard(integer, integer)
  from public, anon, authenticated;
grant execute on function public.set_avatar_shirt_number(integer), public.get_leaderboard(integer, integer)
  to authenticated;

commit;
