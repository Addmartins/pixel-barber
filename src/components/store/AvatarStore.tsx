"use client";

import { useState } from "react";
import { AvatarRenderer } from "@/components/avatar/AvatarRenderer";
import type { AvatarId } from "@/lib/avatars";
import { isCollectionCode } from "@/lib/avatar-collection";
import { customizableShirt, defaultShirtNumber, isShirtNumber, withShirtNumber, type CosmeticProduct, type CosmeticSlot, type InventoryItem, type Rarity } from "@/lib/store";
import { CosmeticSprite } from "./CosmeticSprite";
import styles from "./avatar-store.module.css";

const campaignDate = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Recife" });

const rarities = [
  ["COMUM", "Comuns"], ["RARO", "Raros"], ["LENDARIO", "Lendários"], ["EXCLUSIVO", "Exclusivos de lançamento"],
] as const;
const filters = [["all", "Todos"], ...rarities, ["wardrobe", "Meu Guarda-Roupa"]] as const;
type Category = CosmeticSlot | "football" | "tshirts" | "dresses";

const slots: [Category, string][] = [
  ["head", "Cabeça"], ["body", "Roupas de tronco"], ["football", "Camisas de futebol"], ["tshirts", "Camisetas"], ["dresses", "Vestidos"], ["legs", "Shorts e bermudas"], ["feet", "Tênis"], ["face", "Rosto"], ["tool", "Ferramentas"],
  ["hair", "Cabelo"], ["beard", "Barba e bigode"], ["neck", "Colares"], ["scene", "Cenário"], ["effect", "Efeitos"],
];
const rarityLabels = { COMUM: "Comum", RARO: "Raro", LENDARIO: "Lendário", EXCLUSIVO: "Exclusivo de lançamento" };
const points = new Intl.NumberFormat("pt-BR");
type Filter = "all" | "wardrobe" | Rarity;
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
  onSaveShirtNumber: (number: number) => Promise<void>;
  onEquip: (id: string, equipped: boolean) => Promise<void>;
};

function matchesCategory(product: CosmeticProduct, category: Category | "all") {
  switch (category) {
    case "all": return true;
    case "football": return product.cosmetic_code.startsWith("camisa_");
    case "tshirts": return product.cosmetic_code.startsWith("camiseta_");
    case "dresses": return product.cosmetic_code.startsWith("vestido_");
    default: return product.cosmetic_slot === category;
  }
}

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

export function AvatarStore({ avatar, balance, products, inventory, loading, error, demo, onReload, onBuy, onEquip, onSaveShirtNumber }: StoreProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const [slot, setSlot] = useState<Category | "all">("all");
  const [previewId, setPreviewId] = useState<string>();
  const [shirtNumberInput, setShirtNumberInput] = useState<string>();
  const [pendingId, setPendingId] = useState<string>();
  const [feedback, setFeedback] = useState<{ text: string; error?: boolean }>();
  const owned = new Map(inventory.map((item) => [item.product_id, item]));
  const preview = products.find((product) => product.id === previewId);
  const previewIsShirt = preview?.cosmetic_code === customizableShirt;
  const shirtOwned = Boolean(preview && owned.has(preview.id));
  const savedNumber = (preview && owned.get(preview.id)?.shirt_number) ?? defaultShirtNumber;
  const shirtNumber = shirtNumberInput === undefined ? savedNumber : shirtNumberInput === "" ? NaN : Number(shirtNumberInput);
  const equipped = products.filter((product) => owned.get(product.id)?.is_equipped);
  const fitting = equipped.filter((product) => product.cosmetic_slot !== preview?.cosmetic_slot)
    .map(product => withShirtNumber(product.cosmetic_code, owned.get(product.id)?.shirt_number));
  if (preview) fitting.push(withShirtNumber(preview.cosmetic_code, isShirtNumber(shirtNumber) ? shirtNumber : savedNumber));

  function selectPreview(id?: string) {
    setPreviewId(id);
    setShirtNumberInput(undefined);
  }

  async function personalize(number: number) {
    if (!preview || !shirtOwned || pendingId) return;
    setPendingId(preview.id);
    setFeedback(undefined);
    try {
      await onSaveShirtNumber(number);
      setFeedback({ text: "Número da camisa salvo." });
    } catch (failure) {
      setFeedback({ text: failure instanceof Error ? failure.message : "Não foi possível salvar o número da camisa.", error: true });
    } finally {
      setPendingId(undefined);
    }
  }
  const collectionAvailable = products.some(product => product.cosmetic_code !== "tesoura" && isCollectionCode(product.cosmetic_code));
  const visibleProducts = products.filter(product => {
    if (!matchesCategory(product, slot)) return false;
    if (filter === "wardrobe") return owned.has(product.id);
    if (collectionAvailable && !isCollectionCode(product.cosmetic_code)) return false;
    return filter === "all" || product.rarity === filter;
  });

  async function apply(product: CosmeticProduct, action: Action) {
    if (pendingId) return;
    setPendingId(product.id);
    setFeedback(undefined);
    const audio = beginSound();
    try {
      if (action === "buy") await onBuy(product.id);
      else await onEquip(product.id, action === "equip");
      if (product.cosmetic_code === customizableShirt && action === "buy") {
        if (previewId !== product.id) selectPreview(product.id);
      }
      else selectPreview();
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
        <div className={styles.fittingSprite}><AvatarRenderer skinId={avatar} cosmetics={fitting} /></div>
        <div className={styles.fittingDetails}>
          <h3 id="fitting-title">Provador</h3>
          <p aria-live="polite">{preview ? preview.nome : "Escolha um acessório para experimentar."}</p>
          {previewIsShirt && <form className={styles.shirtNumber} onSubmit={event => {
            event.preventDefault();
            if (isShirtNumber(shirtNumber)) void personalize(shirtNumber);
          }}>
            <label>Número da camisa
              <input type="number" inputMode="numeric" min={0} max={99} step={1} required
                value={shirtNumberInput ?? savedNumber} disabled={Boolean(pendingId)}
                onChange={event => setShirtNumberInput(event.target.value)} />
            </label>
            {shirtOwned && <button type="submit" className={styles.clear}
              disabled={Boolean(pendingId) || !isShirtNumber(shirtNumber) || shirtNumber === savedNumber}>Salvar número</button>}
            {!shirtOwned && <p>Resgate a camisa para salvar o número.</p>}
          </form>}
          {preview && <button type="button" className={styles.clear} onClick={() => selectPreview()}>Limpar prévia</button>}
        </div>
      </section>

      <div className={styles.filters} role="group" aria-label="Raridade e guarda-roupa">
        {filters.map(([key, label]) => (
          <button type="button" key={key} aria-pressed={filter === key} onClick={() => {
            setFilter(key);
            if (key === "EXCLUSIVO") setSlot("all");
          }}>{label}</button>
        ))}
      </div>

      <label className={styles.slotFilter}>
        Categoria
        <select value={slot} onChange={event => setSlot(event.target.value as Category | "all")}>
          <option value="all">Todas</option>
          {slots.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>

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

      {rarities.map(([rarity, label]) => {
        const group = visibleProducts.filter(product => product.rarity === rarity);
        if (!group.length) return null;
        return <section key={rarity} aria-label={label} className={styles.rarityGroup} data-rarity={rarity}>
          <h3>{label}</h3>
          <ul className={styles.grid}>
            {group.map((product) => {
              const status = owned.get(product.id);
              const missing = Math.max(0, product.preco_pontos - balance);
              const action = status?.is_equipped ? "unequip" : status ? "equip" : "buy";
              const soldOut = !status && product.estoque <= 0;
              const deadline = product.redemption_ends_at ? new Date(product.redemption_ends_at) : undefined;
              const expired = !status && deadline !== undefined && deadline.getTime() <= Date.now();
              const disabled = loading || Boolean(pendingId) || expired || soldOut || (!status && missing > 0);
              const actionLabel = status?.is_equipped ? "✓ Equipado" : status ? "Equipar" : expired ? "Prazo encerrado" : soldOut ? "Esgotado"
                : missing ? `Faltam ${points.format(missing)} PTS` : "Resgatar com pontos";
              return (
                <li key={product.id} className={styles.item} data-rarity={product.rarity}>
                  <button type="button" className={styles.preview} aria-pressed={previewId === product.id}
                    aria-label={`Experimentar ${product.nome}`} onClick={() => selectPreview(product.id)}>
                    <span className={styles.art}><CosmeticSprite code={product.cosmetic_code} shirtNumber={status?.shirt_number ?? undefined} /></span>
                    <span className={styles.rarity}>{rarityLabels[product.rarity]}</span>
                    <span className={styles.itemName}>{product.nome}</span>
                  </button>
                  <p className={styles.price}>
                    {status && filter === "wardrobe" ? "Adquirido" : <><span className={styles.coin} aria-hidden="true" /> {points.format(product.preco_pontos)} PTS</>}
                  </p>
                  {!status && (deadline || (demo && rarity === "EXCLUSIVO")) && (
                    <p className={styles.price}>{deadline ? `Até ${campaignDate.format(deadline)} (Recife)` : "Campanha de 90 dias"}</p>
                  )}
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
        </section>;
      })}
    </section>
  );
}
