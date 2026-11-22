export const avatarFashion = {
  camisa_vasco: { name: "Camisa retrô do Vasco", slot: "body", rarity: "RARO", price: 340, art: "vasco", base: "#22242c", light: "#f4ebdf" },
  camisa_flamengo: { name: "Camisa rubro-negra do Flamengo", slot: "body", rarity: "RARO", price: 340, art: "flamengo", base: "#cf3444", light: "#272332" },
  camisa_boca: { name: "Camisa azul do Boca Juniors", slot: "body", rarity: "RARO", price: 340, art: "boca", base: "#26468e", light: "#ffca51" },
  camisa_gremio: { name: "Camisa listrada do Grêmio", slot: "body", rarity: "RARO", price: 340, art: "gremio", base: "#59bdea", light: "#f7f3e6" },
  camisa_brasil: { name: "Camisa da Seleção Brasileira · anos 90", slot: "body", rarity: "LENDARIO", price: 570, art: "brasil", base: "#ffcf41", light: "#248354" },
  camisa_river: { name: "Camisa do River Plate · número personalizável", slot: "body", rarity: "RARO", price: 360, art: "river", base: "#f4eee7", light: "#d84149" },
  camiseta_branca: { name: "Camiseta básica branca", slot: "body", rarity: "COMUM", price: 110, art: "basic", base: "#eeeae6", light: "#fffaf3" },
  camiseta_oversized: { name: "Camiseta oversized preta", slot: "body", rarity: "COMUM", price: 150, art: "oversized", base: "#383343", light: "#696277" },
  camiseta_coringa: { name: "Camiseta streetwear do Coringa", slot: "body", rarity: "RARO", price: 280, art: "joker", base: "#5d3c75", light: "#a9df66" },
  camiseta_batman: { name: "Camiseta minimalista do Batman", slot: "body", rarity: "RARO", price: 280, art: "batman", base: "#303441", light: "#f7ca56" },
  camiseta_tropical: { name: "Camiseta tropical", slot: "body", rarity: "COMUM", price: 170, art: "tropicalShirt", base: "#245f5c", light: "#86c68a" },
  camiseta_tiedye: { name: "Camiseta tie-dye com graffiti", slot: "body", rarity: "RARO", price: 260, art: "graffiti", base: "#6848a6", light: "#ff91c3" },
  shorts_esportivo: { name: "Shorts esportivo preto", slot: "legs", rarity: "COMUM", price: 125, art: "sportShorts", base: "#303040", light: "#dce3e4" },
  shorts_jeans: { name: "Shorts jeans", slot: "legs", rarity: "COMUM", price: 140, art: "denim", base: "#527ba4", light: "#99bdd3" },
  bermuda_cargo: { name: "Bermuda cargo bege", slot: "legs", rarity: "COMUM", price: 165, art: "cargo", base: "#aa855d", light: "#e8c892" },
  shorts_tropical: { name: "Shorts estampado tropical", slot: "legs", rarity: "RARO", price: 230, art: "tropicalShorts", base: "#b74f68", light: "#f7b86e" },
  shorts_street: { name: "Shorts streetwear oversized", slot: "legs", rarity: "RARO", price: 240, art: "streetShorts", base: "#524270", light: "#b68cf0" },
  bone_aba_curva: { name: "Boné preto aba curva", slot: "head", rarity: "COMUM", price: 130, art: "curved", base: "#333440", light: "#6c7280" },
  bone_snapback: { name: "Boné snapback", slot: "head", rarity: "COMUM", price: 145, art: "snap", base: "#a34c75", light: "#f193a7" },
  bone_trucker: { name: "Boné trucker", slot: "head", rarity: "COMUM", price: 150, art: "trucker", base: "#388c9f", light: "#f1e7d6" },
  bucket_estampado: { name: "Bucket hat estampado", slot: "head", rarity: "RARO", price: 235, art: "bucket", base: "#5e704d", light: "#e1b973" },
  tenis_branco: { name: "Tênis branco casual", slot: "feet", rarity: "COMUM", price: 145, art: "casual", base: "#e8e6dd", light: "#fffaf1" },
  tenis_street: { name: "Tênis streetwear preto", slot: "feet", rarity: "COMUM", price: 170, art: "streetShoe", base: "#343347", light: "#b2a1c3" },
  tenis_retro: { name: "Tênis colorido estilo retrô", slot: "feet", rarity: "RARO", price: 260, art: "retroShoe", base: "#507fa8", light: "#f5a25f" },
  tenis_corrida: { name: "Tênis esportivo de corrida", slot: "feet", rarity: "RARO", price: 245, art: "runner", base: "#297b74", light: "#b4ef86" },
  tenis_cano_alto: { name: "Tênis cano alto", slot: "feet", rarity: "RARO", price: 270, art: "highTop", base: "#923f67", light: "#ffafd0" },
  vestido_preto: { name: "Vestido casual preto", slot: "body", rarity: "COMUM", price: 175, art: "blackDress", base: "#363041", light: "#7d6d84" },
  vestido_floral: { name: "Vestido floral", slot: "body", rarity: "RARO", price: 255, art: "floral", base: "#387c71", light: "#ffc0d7" },
  vestido_street: { name: "Vestido streetwear oversized", slot: "body", rarity: "RARO", price: 275, art: "streetDress", base: "#61498a", light: "#a9ebd7" },
  vestido_vermelho: { name: "Vestido elegante vermelho", slot: "body", rarity: "LENDARIO", price: 550, art: "elegant", base: "#a3324c", light: "#f67d8e" },
} as const;

type FashionCode = keyof typeof avatarFashion;
export type FashionItem = (typeof avatarFashion)[FashionCode];

export function isFashionCode(code: string): code is FashionCode {
  return Object.hasOwn(avatarFashion, code);
}
