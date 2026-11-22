import { avatarFashion } from "./avatar-fashion";

export const avatarCollection = {
  ...avatarFashion,
  pente_preto: { name: "Pente preto clássico", slot: "tool", rarity: "COMUM", price: 80, art: "comb", base: "#383b44", light: "#787b86" },
  tesoura_simples: { name: "Tesoura simples", slot: "tool", rarity: "COMUM", price: 100, art: "scissors", base: "#a8abb0", light: "#e3e5e7" },
  navalha_tradicional: { name: "Navalha tradicional", slot: "tool", rarity: "COMUM", price: 120, art: "razor", base: "#63544f", light: "#bdc6d0" },
  maquina_basica: { name: "Máquina de corte básica", slot: "tool", rarity: "COMUM", price: 130, art: "clipper", base: "#39424d", light: "#b9bfcb" },
  avental_preto: { name: "Avental preto", slot: "body", rarity: "COMUM", price: 140, art: "apron", base: "#363943", light: "#757984" },
  escova_cabelo: { name: "Escova de cabelo", slot: "tool", rarity: "COMUM", price: 90, art: "brush", base: "#59616d", light: "#a3a8b2" },
  toalha_branca: { name: "Toalha branca", slot: "body", rarity: "COMUM", price: 100, art: "towel", base: "#e1e2dd", light: "#faf8f1" },
  creme_barbear: { name: "Creme de barbear", slot: "tool", rarity: "COMUM", price: 90, art: "cream", base: "#78a396", light: "#e3f0dc" },
  bigode_fino: { name: "Bigode fino", slot: "beard", rarity: "COMUM", price: 100, art: "moustache", base: "#433234", light: "#6e4840" },
  barba_curta: { name: "Barba curta", slot: "beard", rarity: "COMUM", price: 130, art: "shortBeard", base: "#423239", light: "#75534a" },
  maquina_dourada: { name: "Máquina dourada", slot: "tool", rarity: "RARO", price: 290, art: "clipper", base: "#9d6736", light: "#edc180" },
  tesoura: { name: "Tesoura cromada", slot: "tool", rarity: "RARO", price: 250, art: "scissors", base: "#7894b4", light: "#e4fbff" },
  navalha_personalizada: { name: "Navalha com cabo personalizado", slot: "tool", rarity: "RARO", price: 260, art: "razor", base: "#2d8c89", light: "#b9f3e9" },
  avental_vintage: { name: "Avental vintage", slot: "body", rarity: "RARO", price: 310, art: "apron", base: "#773f39", light: "#d19366" },
  oculos_retro: { name: "Óculos retrô de barbeiro", slot: "face", rarity: "RARO", price: 230, art: "glasses", base: "#5e739c", light: "#cee8d2" },
  bone_club: { name: "Boné Barber Club", slot: "head", rarity: "RARO", price: 240, art: "cap", base: "#295b5e", light: "#9bdccd" },
  barba_lenhador: { name: "Barba lenhador", slot: "beard", rarity: "RARO", price: 280, art: "lumberjack", base: "#5f352c", light: "#ba8262" },
  pompadour_estilo: { name: "Pompadour estilizado", slot: "hair", rarity: "RARO", price: 300, art: "pompadour", base: "#3a2d42", light: "#c084ab" },
  escova_madeira: { name: "Escova com cabo de madeira", slot: "tool", rarity: "RARO", price: 210, art: "brush", base: "#8a5338", light: "#e0b27e" },
  colar_navalha: { name: "Colar com pingente de navalha", slot: "neck", rarity: "RARO", price: 270, art: "necklace", base: "#8b8dae", light: "#eef3ff" },
  maquina_ouro: { name: "Máquina de corte de ouro", slot: "tool", rarity: "LENDARIO", price: 700, art: "clipper", base: "#dc9e35", light: "#fff5aa" },
  navalha_flamejante: { name: "Navalha flamejante", slot: "tool", rarity: "LENDARIO", price: 720, art: "flame", base: "#db4d3f", light: "#ffce6c" },
  coroa_barber: { name: "Coroa Barber King", slot: "head", rarity: "LENDARIO", price: 750, art: "crown", base: "#d69a4d", light: "#ffe8a0" },
  avental_lendario: { name: "Avental lendário com detalhes dourados", slot: "body", rarity: "LENDARIO", price: 650, art: "apron", base: "#33273e", light: "#ffd686" },
  barba_viking: { name: "Barba Viking", slot: "beard", rarity: "LENDARIO", price: 590, art: "viking", base: "#9b543b", light: "#ffca8e" },
  cabelo_neon: { name: "Cabelo neon com degradê", slot: "hair", rarity: "LENDARIO", price: 680, art: "neon", base: "#6c47a4", light: "#80ffe4" },
  tesoura_diamante: { name: "Tesoura de diamante", slot: "tool", rarity: "LENDARIO", price: 800, art: "scissors", base: "#62c5df", light: "#e8fffc" },
  cadeira_barbear: { name: "Cadeira de barbeiro portátil", slot: "scene", rarity: "LENDARIO", price: 850, art: "chair", base: "#8e3457", light: "#ef9aa3" },
  aura_laminas: { name: "Aura de lâminas giratórias", slot: "effect", rarity: "LENDARIO", price: 850, art: "aura", base: "#726ae6", light: "#b9eeff" },
  chapeu_supremo: { name: "Chapéu Barbeiro Supremo", slot: "head", rarity: "LENDARIO", price: 780, art: "hat", base: "#34264f", light: "#f3b4ff" },
  tesoura_prisma: { name: "Tesoura Prisma", slot: "tool", rarity: "EXCLUSIVO", price: 1100, art: "prism", base: "#7297e4", light: "#eefbff" },
  chapeu_fundador: { name: "Chapéu do Fundador", slot: "head", rarity: "EXCLUSIVO", price: 1250, art: "founderHat", base: "#284753", light: "#ffe098" },
  avental_estreia: { name: "Avental Primeira Edição", slot: "body", rarity: "EXCLUSIVO", price: 1400, art: "founderApron", base: "#33415a", light: "#fbd892" },
  trono_inauguracao: { name: "Trono da Inauguração", slot: "scene", rarity: "EXCLUSIVO", price: 1600, art: "founderChair", base: "#1f626a", light: "#f5d08b" },
  aura_letreiro: { name: "Aura Letreiro Neon", slot: "effect", rarity: "EXCLUSIVO", price: 1850, art: "signAura", base: "#6991df", light: "#94fff3" },
} as const;

export type CollectionCode = keyof typeof avatarCollection;
export type CollectionItem = (typeof avatarCollection)[CollectionCode];

export function isCollectionCode(value: unknown): value is CollectionCode {
  return typeof value === "string" && Object.hasOwn(avatarCollection, value);
}
