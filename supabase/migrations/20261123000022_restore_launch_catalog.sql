begin;

-- Restore any missing launch products without replacing inventory IDs or stock.
insert into public.store_products
  (nome, categoria, preco_pontos, estoque, cosmetic_code, cosmetic_slot, rarity, redemption_ends_at)
select item.nome, 'ACESSORIO_AVATAR', item.preco_pontos, item.estoque,
  item.cosmetic_code, item.cosmetic_slot, 'EXCLUSIVO', campaign.ends_at
from (values
  ('Tesoura Prisma', 1100, 100, 'tesoura_prisma', 'tool'),
  ('Chapéu do Fundador', 1250, 100, 'chapeu_fundador', 'head'),
  ('Avental Primeira Edição', 1400, 100, 'avental_estreia', 'body'),
  ('Trono da Inauguração', 1600, 100, 'trono_inauguracao', 'scene'),
  ('Aura Letreiro Neon', 1850, 100, 'aura_letreiro', 'effect')
) as item (nome, preco_pontos, estoque, cosmetic_code, cosmetic_slot)
cross join (
  select coalesce(min(redemption_ends_at), now() + interval '2160 hours') as ends_at
  from public.store_products
  where rarity = 'EXCLUSIVO'
) as campaign
on conflict (cosmetic_code) do nothing;

commit;
