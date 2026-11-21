"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { demoCatalog, type CosmeticProduct, type InventoryItem } from "@/lib/store";
import { buyAvatarItem, equipAvatarItem, loadAvatarShop } from "@/lib/supabase/store";

export function useAvatarShop(clientId: string | undefined, balance: number, onBalance: (balance: number) => void) {
  const [products, setProducts] = useState<CosmeticProduct[]>(clientId ? [] : demoCatalog);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(Boolean(clientId));
  const [error, setError] = useState("");
  const request = useRef(0);

  const reload = useCallback(async () => {
    if (!clientId) return;
    const current = ++request.current;
    setLoading(true);
    setError("");
    try {
      const shop = await loadAvatarShop(clientId);
      if (current !== request.current) return;
      setProducts(shop.products);
      setInventory(shop.inventory);
    } catch (failure) {
      if (current === request.current) {
        setError(failure instanceof Error ? failure.message : "Não foi possível atualizar a loja.");
      }
    } finally {
      if (current === request.current) setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void reload();
    return () => { request.current++; };
  }, [reload]);

  function previewEquip(productId: string, equipped: boolean, acquired: boolean) {
    const slot = products.find((product) => product.id === productId)?.cosmetic_slot;
    setInventory((previous) => [
      ...previous.map((item) => item.product_id === productId ? { ...item, is_equipped: equipped }
        : equipped && products.some((product) => product.id === item.product_id && product.cosmetic_slot === slot)
          ? { ...item, is_equipped: false } : item),
      ...(acquired ? [{ product_id: productId, is_equipped: equipped }] : []),
    ]);
  }

  async function buy(productId: string) {
    if (clientId) {
      onBalance(await buyAvatarItem(productId));
      await reload();
      return;
    }
    const product = products.find(({ id }) => id === productId);
    if (!product || inventory.some(({ product_id }) => product_id === productId)) return;
    if (balance < product.preco_pontos) throw new Error("Seu saldo atual é insuficiente para o resgate.");
    onBalance(balance - product.preco_pontos);
    previewEquip(productId, true, true);
  }

  async function equip(productId: string, equipped: boolean) {
    if (clientId) {
      await equipAvatarItem(productId, equipped);
      await reload();
      return;
    }
    previewEquip(productId, equipped, false);
  }

  const equipped = useMemo(() => products
    .filter(({ id }) => inventory.some(({ product_id, is_equipped }) => product_id === id && is_equipped))
    .map(({ cosmetic_code }) => cosmetic_code), [products, inventory]);

  return { products, inventory, equipped, loading, error, reload, buy, equip };
}
