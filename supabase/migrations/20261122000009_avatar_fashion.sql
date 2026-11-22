begin;

alter table public.store_products
  drop constraint store_products_cosmetic_metadata_check,
  add constraint store_products_cosmetic_metadata_check check (
    (cosmetic_code is null and cosmetic_slot is null and rarity is null)
    or (
      categoria = 'ACESSORIO_AVATAR'
      and cosmetic_code is not null and btrim(cosmetic_code) <> ''
      and cosmetic_slot is not null and cosmetic_slot in ('head', 'body', 'legs', 'feet', 'face', 'tool', 'hair', 'beard', 'neck', 'scene', 'effect')
      and rarity is not null and rarity in ('COMUM', 'RARO', 'LENDARIO', 'EXCLUSIVO')
    )
  );

insert into public.store_products
  (nome, categoria, preco_pontos, estoque, cosmetic_code, cosmetic_slot, rarity)
values
  ('Camisa retrô do Vasco', 'ACESSORIO_AVATAR', 340, 100, 'camisa_vasco', 'body', 'RARO'),
  ('Camisa rubro-negra do Flamengo', 'ACESSORIO_AVATAR', 340, 100, 'camisa_flamengo', 'body', 'RARO'),
  ('Camisa azul do Boca Juniors', 'ACESSORIO_AVATAR', 340, 100, 'camisa_boca', 'body', 'RARO'),
  ('Camisa listrada do Grêmio', 'ACESSORIO_AVATAR', 340, 100, 'camisa_gremio', 'body', 'RARO'),
  ('Camisa da Seleção Brasileira · anos 90', 'ACESSORIO_AVATAR', 570, 100, 'camisa_brasil', 'body', 'LENDARIO'),
  ('Camisa do River Plate · número personalizável', 'ACESSORIO_AVATAR', 360, 100, 'camisa_river', 'body', 'RARO'),
  ('Camiseta básica branca', 'ACESSORIO_AVATAR', 110, 100, 'camiseta_branca', 'body', 'COMUM'),
  ('Camiseta oversized preta', 'ACESSORIO_AVATAR', 150, 100, 'camiseta_oversized', 'body', 'COMUM'),
  ('Camiseta streetwear do Coringa', 'ACESSORIO_AVATAR', 280, 100, 'camiseta_coringa', 'body', 'RARO'),
  ('Camiseta minimalista do Batman', 'ACESSORIO_AVATAR', 280, 100, 'camiseta_batman', 'body', 'RARO'),
  ('Camiseta tropical', 'ACESSORIO_AVATAR', 170, 100, 'camiseta_tropical', 'body', 'COMUM'),
  ('Camiseta tie-dye com graffiti', 'ACESSORIO_AVATAR', 260, 100, 'camiseta_tiedye', 'body', 'RARO'),
  ('Shorts esportivo preto', 'ACESSORIO_AVATAR', 125, 100, 'shorts_esportivo', 'legs', 'COMUM'),
  ('Shorts jeans', 'ACESSORIO_AVATAR', 140, 100, 'shorts_jeans', 'legs', 'COMUM'),
  ('Bermuda cargo bege', 'ACESSORIO_AVATAR', 165, 100, 'bermuda_cargo', 'legs', 'COMUM'),
  ('Shorts estampado tropical', 'ACESSORIO_AVATAR', 230, 100, 'shorts_tropical', 'legs', 'RARO'),
  ('Shorts streetwear oversized', 'ACESSORIO_AVATAR', 240, 100, 'shorts_street', 'legs', 'RARO'),
  ('Boné preto aba curva', 'ACESSORIO_AVATAR', 130, 100, 'bone_aba_curva', 'head', 'COMUM'),
  ('Boné snapback', 'ACESSORIO_AVATAR', 145, 100, 'bone_snapback', 'head', 'COMUM'),
  ('Boné trucker', 'ACESSORIO_AVATAR', 150, 100, 'bone_trucker', 'head', 'COMUM'),
  ('Bucket hat estampado', 'ACESSORIO_AVATAR', 235, 100, 'bucket_estampado', 'head', 'RARO'),
  ('Tênis branco casual', 'ACESSORIO_AVATAR', 145, 100, 'tenis_branco', 'feet', 'COMUM'),
  ('Tênis streetwear preto', 'ACESSORIO_AVATAR', 170, 100, 'tenis_street', 'feet', 'COMUM'),
  ('Tênis colorido estilo retrô', 'ACESSORIO_AVATAR', 260, 100, 'tenis_retro', 'feet', 'RARO'),
  ('Tênis esportivo de corrida', 'ACESSORIO_AVATAR', 245, 100, 'tenis_corrida', 'feet', 'RARO'),
  ('Tênis cano alto', 'ACESSORIO_AVATAR', 270, 100, 'tenis_cano_alto', 'feet', 'RARO'),
  ('Vestido casual preto', 'ACESSORIO_AVATAR', 175, 100, 'vestido_preto', 'body', 'COMUM'),
  ('Vestido floral', 'ACESSORIO_AVATAR', 255, 100, 'vestido_floral', 'body', 'RARO'),
  ('Vestido streetwear oversized', 'ACESSORIO_AVATAR', 275, 100, 'vestido_street', 'body', 'RARO'),
  ('Vestido elegante vermelho', 'ACESSORIO_AVATAR', 550, 100, 'vestido_vermelho', 'body', 'LENDARIO')
on conflict (cosmetic_code) do nothing;

commit;
