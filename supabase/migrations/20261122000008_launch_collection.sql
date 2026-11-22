begin;

alter table public.store_products
  drop constraint store_products_cosmetic_metadata_check,
  add constraint store_products_cosmetic_metadata_check check (
    (cosmetic_code is null and cosmetic_slot is null and rarity is null)
    or (
      categoria = 'ACESSORIO_AVATAR'
      and cosmetic_code is not null and btrim(cosmetic_code) <> ''
      and cosmetic_slot is not null and cosmetic_slot in ('head', 'body', 'face', 'tool', 'hair', 'beard', 'neck', 'scene', 'effect')
      and rarity is not null and rarity in ('COMUM', 'RARO', 'LENDARIO', 'EXCLUSIVO')
    )
  );

insert into public.store_products
  (nome, categoria, preco_pontos, estoque, cosmetic_code, cosmetic_slot, rarity)
values
  ('Tesoura Prisma', 'ACESSORIO_AVATAR', 1100, 100, 'tesoura_prisma', 'tool', 'EXCLUSIVO'),
  ('Chapéu do Fundador', 'ACESSORIO_AVATAR', 1250, 100, 'chapeu_fundador', 'head', 'EXCLUSIVO'),
  ('Avental Primeira Edição', 'ACESSORIO_AVATAR', 1400, 100, 'avental_estreia', 'body', 'EXCLUSIVO'),
  ('Trono da Inauguração', 'ACESSORIO_AVATAR', 1600, 100, 'trono_inauguracao', 'scene', 'EXCLUSIVO'),
  ('Aura Letreiro Neon', 'ACESSORIO_AVATAR', 1850, 100, 'aura_letreiro', 'effect', 'EXCLUSIVO')
on conflict (cosmetic_code) do nothing;

commit;
