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
import { LocationAccessGate } from "@/components/location/LocationAccessGate";
import { getSupabase } from "@/lib/supabase/browser";

const pageSize = 50;

export function Dashboard({ clientId, name, avatar, balance, initialSection = "booking", onPointsBalance, onCosmetics }: {
  clientId?: string;
  name: string;
  avatar: AvatarId;
  balance: number;
  initialSection?: "booking" | "arcade";
  onPointsBalance: (balance: number) => void;
  onCosmetics: (cosmetics: EquippedCosmetic[]) => void;
}) {
  const [section, setSection] = useState<"booking" | "mural" | "arcade" | "store">(initialSection);
  const [arcadeOpened, setArcadeOpened] = useState(initialSection === "arcade");
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

  const [clubAccess, setClubAccess] = useState<{ checked: boolean; approved: boolean }>({
    checked: !clientId,
    approved: !clientId,
  });
  const [accessAttempt, setAccessAttempt] = useState(0);
  const [demoBooking, setDemoBooking] = useState(false);
  const demoApi = useMemo(() => createDemoBookingApi(), []);

  useEffect(() => {
    if (!clientId) return;
    let active = true;
    void (async () => {
      try {
        const res = await getSupabase()?.rpc("has_club_access");
        if (!active) return;
        if (res && !res.error) {
          setClubAccess({ checked: true, approved: Boolean(res.data) });
        } else {
          setClubAccess({ checked: true, approved: false });
        }
      } catch {
        if (active) setClubAccess({ checked: true, approved: false });
      }
    })();
    return () => { active = false; };
  }, [clientId, accessAttempt]);

  useEffect(() => {
    if (!clientId || section !== "mural" || !clubAccess.approved) return;
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
  }, [clientId, request, section, clubAccess.approved]);

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
        <button type="button" aria-pressed={section === "store"} onClick={() => {
          if (section !== "store") void shop.reload();
          setStoreOpened(true);
          setSection("store");
        }}>
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
      {section === "booking" && (
        <>
          {clientId && !clubAccess.checked ? (
            <p role="status">Verificando permissão de acesso…</p>
          ) : clientId && !clubAccess.approved && !demoBooking ? (
            <LocationAccessGate
              clientId={clientId}
              title="Agendamentos & Barbeiros"
              description="Para visualizar os barbeiros reais e realizar agendamentos, o acesso é liberado por geolocalização física (clientes da região) ou aprovação do administrador."
              onApproved={() => {
                setClubAccess({ checked: true, approved: true });
                setAccessAttempt((prev) => prev + 1);
              }}
              onTestDemo={() => setDemoBooking(true)}
            />
          ) : (
            <div className="space-y-3">
              {demoBooking && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 p-3 text-sm">
                  <span className="muted">Modo demonstração (dados fictícios para teste de portfólio).</span>
                  <button type="button" className="secondary text-xs" onClick={() => setDemoBooking(false)}>
                    Voltar para solicitação
                  </button>
                </div>
              )}
              <Booking api={demoBooking ? demoApi : api} />
            </div>
          )}
        </>
      )}
      {section === "mural" && (
        <>
          {clientId && !clubAccess.checked ? (
            <p role="status">Verificando permissão de acesso…</p>
          ) : clientId && !clubAccess.approved ? (
            <LocationAccessGate
              clientId={clientId}
              title="Mural, Álbuns & Classificação"
              description="O mural de cortes, álbuns dos barbeiros e o ranking são exclusivos para clientes locais da barbearia ou membros com acesso aprovado."
              onApproved={() => {
                setClubAccess({ checked: true, approved: true });
                setAccessAttempt((prev) => prev + 1);
              }}
            />
          ) : (
            <>
              {clientId && <NoticeBoard clientId={clientId} />}
              <Mural ranking={clientId ? ranking : demoLeaderboard} loading={rankingBusy && !ranking.length} error={rankingError}
                loadingMore={rankingBusy && Boolean(ranking.length)} hasMore={hasMore}
                onLoadMore={() => { if (!rankingBusy) setRequest({ offset: rankingOffset }); }} />
              {rankingError && <button type="button" className="secondary mt-3"
                onClick={() => setRequest({ offset: request.offset })}>Tentar classificação novamente</button>}
            </>
          )}
        </>
      )}
    </div>
  );
}
