begin;

alter table public.store_products
  drop constraint store_products_cosmetic_metadata_check,
  add constraint store_products_cosmetic_metadata_check check (
    (cosmetic_code is null and cosmetic_slot is null and rarity is null)
    or (
      categoria = 'ACESSORIO_AVATAR'
      and cosmetic_code is not null and btrim(cosmetic_code) <> ''
      and cosmetic_slot is not null and cosmetic_slot in ('head', 'body', 'face', 'tool', 'hair', 'beard', 'neck', 'scene', 'effect')
      and rarity is not null and rarity in ('COMUM', 'RARO', 'LENDARIO')
    )
  );

-- The existing chrome scissors keep their product ID, stock and inventory references.
insert into public.store_products
  (nome, categoria, preco_pontos, estoque, cosmetic_code, cosmetic_slot, rarity)
values
  ('Pente preto clássico', 'ACESSORIO_AVATAR', 80, 100, 'pente_preto', 'tool', 'COMUM'),
  ('Tesoura simples', 'ACESSORIO_AVATAR', 100, 100, 'tesoura_simples', 'tool', 'COMUM'),
  ('Navalha tradicional', 'ACESSORIO_AVATAR', 120, 100, 'navalha_tradicional', 'tool', 'COMUM'),
  ('Máquina de corte básica', 'ACESSORIO_AVATAR', 130, 100, 'maquina_basica', 'tool', 'COMUM'),
  ('Avental preto', 'ACESSORIO_AVATAR', 140, 100, 'avental_preto', 'body', 'COMUM'),
  ('Escova de cabelo', 'ACESSORIO_AVATAR', 90, 100, 'escova_cabelo', 'tool', 'COMUM'),
  ('Toalha branca', 'ACESSORIO_AVATAR', 100, 100, 'toalha_branca', 'body', 'COMUM'),
  ('Creme de barbear', 'ACESSORIO_AVATAR', 90, 100, 'creme_barbear', 'tool', 'COMUM'),
  ('Bigode fino', 'ACESSORIO_AVATAR', 100, 100, 'bigode_fino', 'beard', 'COMUM'),
  ('Barba curta', 'ACESSORIO_AVATAR', 130, 100, 'barba_curta', 'beard', 'COMUM'),
  ('Máquina dourada', 'ACESSORIO_AVATAR', 290, 100, 'maquina_dourada', 'tool', 'RARO'),
  ('Tesoura cromada', 'ACESSORIO_AVATAR', 250, 100, 'tesoura', 'tool', 'RARO'),
  ('Navalha com cabo personalizado', 'ACESSORIO_AVATAR', 260, 100, 'navalha_personalizada', 'tool', 'RARO'),
  ('Avental vintage', 'ACESSORIO_AVATAR', 310, 100, 'avental_vintage', 'body', 'RARO'),
  ('Óculos retrô de barbeiro', 'ACESSORIO_AVATAR', 230, 100, 'oculos_retro', 'face', 'RARO'),
  ('Boné Barber Club', 'ACESSORIO_AVATAR', 240, 100, 'bone_club', 'head', 'RARO'),
  ('Barba lenhador', 'ACESSORIO_AVATAR', 280, 100, 'barba_lenhador', 'beard', 'RARO'),
  ('Pompadour estilizado', 'ACESSORIO_AVATAR', 300, 100, 'pompadour_estilo', 'hair', 'RARO'),
  ('Escova com cabo de madeira', 'ACESSORIO_AVATAR', 210, 100, 'escova_madeira', 'tool', 'RARO'),
  ('Colar com pingente de navalha', 'ACESSORIO_AVATAR', 270, 100, 'colar_navalha', 'neck', 'RARO'),
  ('Máquina de corte de ouro', 'ACESSORIO_AVATAR', 700, 100, 'maquina_ouro', 'tool', 'LENDARIO'),
  ('Navalha flamejante', 'ACESSORIO_AVATAR', 720, 100, 'navalha_flamejante', 'tool', 'LENDARIO'),
  ('Coroa Barber King', 'ACESSORIO_AVATAR', 750, 100, 'coroa_barber', 'head', 'LENDARIO'),
  ('Avental lendário com detalhes dourados', 'ACESSORIO_AVATAR', 650, 100, 'avental_lendario', 'body', 'LENDARIO'),
  ('Barba Viking', 'ACESSORIO_AVATAR', 590, 100, 'barba_viking', 'beard', 'LENDARIO'),
  ('Cabelo neon com degradê', 'ACESSORIO_AVATAR', 680, 100, 'cabelo_neon', 'hair', 'LENDARIO'),
  ('Tesoura de diamante', 'ACESSORIO_AVATAR', 800, 100, 'tesoura_diamante', 'tool', 'LENDARIO'),
  ('Cadeira de barbeiro portátil', 'ACESSORIO_AVATAR', 850, 100, 'cadeira_barbear', 'scene', 'LENDARIO'),
  ('Aura de lâminas giratórias', 'ACESSORIO_AVATAR', 850, 100, 'aura_laminas', 'effect', 'LENDARIO'),
  ('Chapéu Barbeiro Supremo', 'ACESSORIO_AVATAR', 780, 100, 'chapeu_supremo', 'head', 'LENDARIO')
on conflict (cosmetic_code) do nothing;

update public.store_products set nome = 'Tesoura cromada' where cosmetic_code = 'tesoura';

commit;
