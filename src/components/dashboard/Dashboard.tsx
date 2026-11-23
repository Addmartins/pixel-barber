"use client";

import { CalendarDays, Gamepad2, Images, ShoppingBag } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createDemoBookingApi, demoRanking } from "@/lib/demo-booking";
import { createBookingApi, getRankingPage } from "@/lib/supabase/booking";
import type { RankingEntry } from "@/lib/supabase/browser";
import { Arcade } from "@/components/games/Arcade";
import { AvatarStore } from "@/components/store/AvatarStore";
import { useAvatarShop } from "@/components/store/useAvatarShop";
import type { AvatarId } from "@/lib/avatars";
import { splitCosmetic, type EquippedCosmetic } from "@/lib/store";
import { Booking } from "./Booking";
import { Mural } from "./Mural";
import { NoticeBoard } from "./NoticeBoard";

const pageSize = 50;

export function Dashboard({ clientId, name, avatar, balance, onPointsBalance, onCosmetics }: {
  clientId?: string;
  name: string;
  avatar: AvatarId;
  balance: number;
  onPointsBalance: (balance: number) => void;
  onCosmetics: (cosmetics: EquippedCosmetic[]) => void;
}) {
  const [section, setSection] = useState<"booking" | "mural" | "arcade" | "store">("booking");
  const [arcadeOpened, setArcadeOpened] = useState(false);
  const [storeOpened, setStoreOpened] = useState(false);
  const api = useMemo(() => clientId ? createBookingApi(clientId) : createDemoBookingApi(), [clientId]);
  const [ranking, setRanking] = useState<RankingEntry[]>(clientId ? [] : demoRanking);
  const [rankingOffset, setRankingOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [rankingBusy, setRankingBusy] = useState(Boolean(clientId));
  const [rankingError, setRankingError] = useState("");
  const [request, setRequest] = useState({ offset: 0 });

  const updateBalance = useCallback((balance: number) => {
    onPointsBalance(balance);
    setRequest({ offset: 0 });
  }, [onPointsBalance]);

  const shop = useAvatarShop(clientId, balance, updateBalance);
  useEffect(() => { onCosmetics(shop.equipped); }, [shop.equipped, onCosmetics]);

  const outfit = shop.equipped.map(splitCosmetic);
  const demoLeaderboard = [...demoRanking, {
    position: 0, display_name: name.split(/\s+/)[0], avatar_skin: avatar, points_balance: 0, equipped_cosmetics: outfit.map(item => item.code), shirt_number: outfit.find(item => item.shirtNumber !== undefined)?.shirtNumber,
  }].sort((a, b) => b.points_balance - a.points_balance).map((entry, index) => ({ ...entry, position: index + 1 }));

  useEffect(() => {
    if (!clientId || section !== "mural") return;
    let active = true;
    setRankingBusy(true);
    setRankingError("");
    getRankingPage(pageSize, request.offset).then((rows) => {
      if (!active) return;
      setRanking((previous) => request.offset ? [...previous, ...rows] : rows);
      setRankingOffset(request.offset + rows.length);
      setHasMore(rows.length === pageSize);
    }).catch(() => {
      if (active) setRankingError("Não foi possível carregar a classificação.");
    }).finally(() => {
      if (active) setRankingBusy(false);
    });
    return () => { active = false; };
  }, [clientId, request, section]);

  return (
    <div className="dashboard">
      <nav className="dashboard-nav mode-switch bottom-nav" aria-label="Painel do cliente">
        <button type="button" aria-pressed={section === "booking"} onClick={() => setSection("booking")}>
          <CalendarDays size={18} aria-hidden="true" /> Agendar
        </button>
        <button type="button" aria-pressed={section === "arcade"} onClick={() => {
          setArcadeOpened(true);
          setSection("arcade");
        }}>
          <Gamepad2 size={18} aria-hidden="true" /> Pixel Boy
        </button>
        <button type="button" aria-pressed={section === "store"} onClick={() => { setStoreOpened(true); setSection("store"); }}>
          <ShoppingBag size={18} aria-hidden="true" /> Loja
        </button>
        <button type="button" aria-pressed={section === "mural"} onClick={() => {
          if (section !== "mural") setRequest({ offset: 0 });
          setSection("mural");
        }}>
          <Images size={18} aria-hidden="true" /> Mural
        </button>
      </nav>
      {storeOpened && <div hidden={section !== "store"}><AvatarStore avatar={avatar} balance={balance} products={shop.products}
        inventory={shop.inventory} loading={shop.loading} error={shop.error} demo={!clientId}
        onReload={() => void shop.reload()} onBuy={shop.buy} onEquip={shop.equip} onSaveShirtNumber={shop.saveShirtNumber} /></div>}
      {arcadeOpened && <div hidden={section !== "arcade"}>
        <Arcade clientId={clientId} avatar={avatar} cosmetics={shop.equipped} demo={!clientId} visible={section === "arcade"} onBalance={updateBalance} />
      </div>}
      <div hidden={section !== "booking"}><Booking api={api} /></div>
      {section === "mural" && (
        <>
          {clientId && <NoticeBoard clientId={clientId} />}
          <Mural ranking={clientId ? ranking : demoLeaderboard} loading={rankingBusy && !ranking.length} error={rankingError}
            loadingMore={rankingBusy && Boolean(ranking.length)} hasMore={hasMore}
            onLoadMore={() => { if (!rankingBusy) setRequest({ offset: rankingOffset }); }} />
          {rankingError && <button type="button" className="secondary mt-3"
            onClick={() => setRequest({ offset: request.offset })}>Tentar classificação novamente</button>}
        </>
      )}
    </div>
  );
}
