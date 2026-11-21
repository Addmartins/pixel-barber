export const cosmeticCodes = ["snapback", "boina", "aviador", "avental", "jaqueta", "navalha", "bandana", "tesoura"] as const;
export type CosmeticCode = (typeof cosmeticCodes)[number];
export type CosmeticSlot = "head" | "body" | "face" | "tool";
export type Rarity = "COMUM" | "RARO" | "LENDARIO";

export type CosmeticProduct = {
  id: string;
  nome: string;
  preco_pontos: number;
  estoque: number;
  cosmetic_code: CosmeticCode;
  cosmetic_slot: CosmeticSlot;
  rarity: Rarity;
};

export type InventoryItem = { product_id: string; is_equipped: boolean };

export function isCosmeticCode(value: unknown): value is CosmeticCode {
  return cosmeticCodes.some((code) => code === value);
}

export const demoCatalog: CosmeticProduct[] = [
  { id: "snapback", cosmetic_code: "snapback", nome: "Boné Snapback Pixel Barber", cosmetic_slot: "head", rarity: "COMUM", preco_pontos: 150, estoque: 100 },
  { id: "boina", cosmetic_code: "boina", nome: "Boina Peaky Blinders", cosmetic_slot: "head", rarity: "RARO", preco_pontos: 300, estoque: 100 },
  { id: "aviador", cosmetic_code: "aviador", nome: "Óculos Escuros Aviador", cosmetic_slot: "face", rarity: "COMUM", preco_pontos: 200, estoque: 100 },
  { id: "avental", cosmetic_code: "avental", nome: "Avental de Couro com Tesouras", cosmetic_slot: "body", rarity: "RARO", preco_pontos: 400, estoque: 100 },
  { id: "jaqueta", cosmetic_code: "jaqueta", nome: "Jaqueta Jeans Desfiada", cosmetic_slot: "body", rarity: "RARO", preco_pontos: 500, estoque: 100 },
  { id: "navalha", cosmetic_code: "navalha", nome: "Navalha de Ouro Reluzente", cosmetic_slot: "tool", rarity: "LENDARIO", preco_pontos: 800, estoque: 100 },
  { id: "bandana", cosmetic_code: "bandana", nome: "Bandana Quadriculada", cosmetic_slot: "head", rarity: "COMUM", preco_pontos: 100, estoque: 100 },
  { id: "tesoura", cosmetic_code: "tesoura", nome: "Tesoura Cromada", cosmetic_slot: "tool", rarity: "RARO", preco_pontos: 250, estoque: 100 },
];
