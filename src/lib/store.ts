import { avatarCollection, isCollectionCode, type CollectionCode } from "./avatar-collection";

const legacySlots = {
  snapback: "head", boina: "head", aviador: "face", avental: "body",
  jaqueta: "body", navalha: "tool", bandana: "head",
} as const;

export type CosmeticCode = keyof typeof legacySlots | CollectionCode;
export type CosmeticSlot = "head" | "body" | "face" | "tool" | "hair" | "beard" | "neck" | "scene" | "effect";
export type Rarity = "COMUM" | "RARO" | "LENDARIO" | "EXCLUSIVO";

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
  return isCollectionCode(value) || (typeof value === "string" && Object.hasOwn(legacySlots, value));
}

export function cosmeticSlot(code: CosmeticCode): CosmeticSlot {
  return isCollectionCode(code) ? avatarCollection[code].slot : legacySlots[code];
}

export const demoCatalog: CosmeticProduct[] = (Object.keys(avatarCollection) as CollectionCode[]).map(code => {
  const item = avatarCollection[code];
  return {
    id: code,
    cosmetic_code: code,
    nome: item.name,
    cosmetic_slot: item.slot,
    rarity: item.rarity,
    preco_pontos: item.price,
    estoque: 100,
  };
});
