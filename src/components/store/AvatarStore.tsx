"use client";

import { useState } from "react";
import { AvatarSprite } from "@/components/auth/AvatarSprite";
import type { AvatarId } from "@/lib/avatars";
import type { CosmeticProduct, InventoryItem } from "@/lib/store";
import { CosmeticSprite } from "./CosmeticSprite";
import styles from "./avatar-store.module.css";

const filters = [
  ["all", "Todos"],
  ["head", "Cabeça"],
  ["body", "Roupas"],
  ["face", "Rosto"],
  ["tool", "Ferramentas"],
  ["wardrobe", "Meu Guarda-Roupa"],
] as const;

const rarityLabels = { COMUM: "Comum", RARO: "Raro", LENDARIO: "Lendário" };
const points = new Intl.NumberFormat("pt-BR");
type Filter = (typeof filters)[number][0];
type Action = "buy" | "equip" | "unequip";

type StoreProps = {
  avatar: AvatarId;
  balance: number;
  products: CosmeticProduct[];
  inventory: InventoryItem[];
  loading: boolean;
  error: string;
  demo: boolean;
  onReload: () => void;
  onBuy: (id: string) => Promise<void>;
  onEquip: (id: string, equipped: boolean) => Promise<void>;
};

function beginSound() {
  if (typeof AudioContext === "undefined") return;
  try {
    const context = new AudioContext();
    void context.resume().catch(() => {});
    return context;
  } catch {
    return undefined;
  }
}

function endSound(context: AudioContext | undefined, action?: Action) {
  if (!context) return;
  if (!action || context.state !== "running") {
    void context.close().catch(() => {});
    return;
  }

  try {
    const note = context.createOscillator();
    const volume = context.createGain();
    const start = context.currentTime;
    note.type = "square";
    const sequence = action === "buy" ? [523, 659, 784] : action === "equip" ? [587, 880] : [659, 440];
    sequence.forEach((frequency, index) => note.frequency.setValueAtTime(frequency, start + index * .065));
    volume.gain.setValueAtTime(.045, start);
    volume.gain.exponentialRampToValueAtTime(.001, start + .22);
    note.connect(volume).connect(context.destination);
    note.onended = () => { void context.close().catch(() => {}); };
    note.start(start);
    note.stop(start + .23);
  } catch {
    void context.close().catch(() => {});
  }
}

export function AvatarStore({ avatar, balance, products, inventory, loading, error, demo, onReload, onBuy, onEquip }: StoreProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const [previewId, setPreviewId] = useState<string>();
  const [pendingId, setPendingId] = useState<string>();
  const [feedback, setFeedback] = useState<{ text: string; error?: boolean }>();
  const owned = new Map(inventory.map((item) => [item.product_id, item]));
  const preview = products.find((product) => product.id === previewId);
  const equipped = products.filter((product) => owned.get(product.id)?.is_equipped);
  const fitting = equipped.filter((product) => product.cosmetic_slot !== preview?.cosmetic_slot)
    .map((product) => product.cosmetic_code);
  if (preview) fitting.push(preview.cosmetic_code);
  const visibleProducts = products.filter((product) => (
    filter === "all" || (filter === "wardrobe" ? owned.has(product.id) : product.cosmetic_slot === filter)
  ));

  async function apply(product: CosmeticProduct, action: Action) {
    if (pendingId) return;
    setPendingId(product.id);
    setFeedback(undefined);
    const audio = beginSound();
    try {
      if (action === "buy") await onBuy(product.id);
      else await onEquip(product.id, action === "equip");
      setPreviewId(undefined);
      const text = action === "buy" ? "Resgate concluído."
        : action === "equip" ? "Acessório equipado." : "Acessório removido do avatar.";
      setFeedback({ text });
      endSound(audio, action);
    } catch (failure) {
      setFeedback({ text: failure instanceof Error ? failure.message : "Não foi possível atualizar o guarda-roupa.", error: true });
      endSound(audio);
    } finally {
      setPendingId(undefined);
    }
  }

  return (
    <section className={styles.store} aria-labelledby="avatar-store-title">
      <div className={styles.heading}>
        <h2 id="avatar-store-title">Loja do Avatar</h2>
        {demo && <p>Modo demonstração · itens desta visita</p>}
      </div>
      <div className={styles.balance} role="status">
        <span className={styles.coin} aria-hidden="true" />
        <span>Seu saldo</span>
        <strong>{points.format(balance)} <small>PTS</small></strong>
      </div>

      <section className={styles.fitting} aria-labelledby="fitting-title">
        <div className={styles.fittingSprite}><AvatarSprite id={avatar} cosmetics={fitting} /></div>
        <div className={styles.fittingDetails}>
          <h3 id="fitting-title">Provador</h3>
          <p aria-live="polite">{preview ? preview.nome : "Escolha um acessório para experimentar."}</p>
          {preview && <button type="button" className={styles.clear} onClick={() => setPreviewId(undefined)}>Limpar prévia</button>}
        </div>
      </section>

      <div className={styles.filters} role="group" aria-label="Filtros de acessórios">
        {filters.map(([key, label]) => (
          <button type="button" key={key} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>
        ))}
      </div>

      {error && (
        <div className={styles.error}>
          <p role="alert">{error}</p>
          <button type="button" className={styles.clear} disabled={loading || Boolean(pendingId)} onClick={onReload}>Tentar de novo</button>
        </div>
      )}
      {feedback && <p className={feedback.error ? styles.error : styles.success} role={feedback.error ? "alert" : "status"}>{feedback.text}</p>}
      {loading && <p className={styles.message} role="status">Carregando acessórios…</p>}
      {!loading && !error && visibleProducts.length === 0 && (
        <p className={styles.message}>{filter === "wardrobe" ? "Seu guarda-roupa ainda está vazio." : "Nenhum acessório nesta categoria."}</p>
      )}

      <ul className={styles.grid}>
        {visibleProducts.map((product) => {
          const status = owned.get(product.id);
          const missing = Math.max(0, product.preco_pontos - balance);
          const action = status?.is_equipped ? "unequip" : status ? "equip" : "buy";
          const soldOut = !status && product.estoque <= 0;
          const disabled = loading || Boolean(pendingId) || soldOut || (!status && missing > 0);
          const actionLabel = status?.is_equipped ? "✓ Equipado" : status ? "Equipar" : soldOut ? "Esgotado"
            : missing ? `Faltam ${points.format(missing)} PTS` : "Resgatar com pontos";
          return (
            <li key={product.id} className={styles.item} data-rarity={product.rarity}>
              <button type="button" className={styles.preview} aria-pressed={previewId === product.id}
                aria-label={`Experimentar ${product.nome}`} onClick={() => setPreviewId(product.id)}>
                <span className={styles.art}><CosmeticSprite code={product.cosmetic_code} /></span>
                <span className={styles.rarity}>{rarityLabels[product.rarity]}</span>
                <span className={styles.itemName}>{product.nome}</span>
              </button>
              <p className={styles.price}>
                {status && filter === "wardrobe" ? "Adquirido" : <><span className={styles.coin} aria-hidden="true" /> {points.format(product.preco_pontos)} PTS</>}
              </p>
              <button type="button" className={styles.action} data-action={action} disabled={disabled}
                title={status?.is_equipped ? "Desequipar acessório" : undefined}
                aria-label={status?.is_equipped ? `Equipado. Desequipar ${product.nome}` : undefined}
                onClick={() => { void apply(product, action); }}>
                {pendingId === product.id ? "Atualizando…" : actionLabel}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
