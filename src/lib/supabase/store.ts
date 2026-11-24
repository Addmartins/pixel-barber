import { deviceApi } from "../device/api";
import { getSupabase } from "./browser";
import { isCosmeticCode, type CosmeticProduct, type InventoryItem } from "../store";

function database() {
  const supabase = getSupabase();
  if (!supabase) throw new Error("A loja está indisponível.");
  return supabase;
}

export async function loadAvatarShop(clientId: string) {
  const supabase = database();
  const [catalog, inventory] = await Promise.all([
    supabase.from("store_products")
      .select("*")
      .eq("categoria", "ACESSORIO_AVATAR").order("preco_pontos"),
    supabase.from("client_inventory").select("*").eq("client_id", clientId),
  ]);
  if (catalog.error || inventory.error) throw new Error("Não foi possível carregar a loja e o guarda-roupa.");
  const products = catalog.data.filter((row): row is CosmeticProduct & { categoria: string } =>
    isCosmeticCode(row.cosmetic_code) && row.preco_pontos !== null && row.cosmetic_slot !== null && row.rarity !== null);
  return { products, inventory: inventory.data.map(({ product_id, is_equipped, shirt_number }): InventoryItem => ({ product_id, is_equipped, shirt_number })) };
}

export async function buyAvatarItem(productId: string) {
  const { data } = await database().auth.getSession();
  if (!data.session) throw new Error("Entre na sua conta para resgatar um acessório.");
  const response = await fetch(deviceApi("/api/store/avatar/buy"), {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${data.session.access_token}` },
    body: JSON.stringify({ product_id: productId }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !Number.isSafeInteger(result?.points_balance)) {
    throw new Error(typeof result?.error === "string" ? result.error : "Não foi possível concluir o resgate.");
  }
  return result.points_balance as number;
}

export async function equipAvatarItem(productId: string, equipped: boolean) {
  const { data, error } = await database().rpc("equip_avatar_item", { p_product_id: productId, p_equipped: equipped });
  if (error || data !== equipped) throw new Error("Não foi possível atualizar o acessório equipado.");
}

export async function saveAvatarShirtNumber(number: number) {
  const { data, error } = await database().rpc("set_avatar_shirt_number", { p_number: number });
  if (error || data !== number) throw new Error("Não foi possível salvar o número da camisa.");
}
