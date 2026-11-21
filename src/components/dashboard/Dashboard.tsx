"use client";

import { CalendarDays, Gamepad2, Images } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createDemoBookingApi, demoRanking } from "@/lib/demo-booking";
import { createBookingApi, getRankingPage } from "@/lib/supabase/booking";
import type { RankingEntry } from "@/lib/supabase/browser";
import { Arcade } from "@/components/games/Arcade";
import { Booking } from "./Booking";
import { Mural } from "./Mural";

const pageSize = 50;

export function Dashboard({ clientId, onPointsBalance }: { clientId?: string; onPointsBalance: (balance: number) => void }) {
  const [section, setSection] = useState<"booking" | "mural" | "arcade">("booking");
  const [arcadeOpened, setArcadeOpened] = useState(false);
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
      <nav className="dashboard-nav mode-switch dashboard-with-arcade" aria-label="Painel do cliente">
        <button type="button" aria-pressed={section === "booking"} onClick={() => setSection("booking")}>
          <CalendarDays size={18} aria-hidden="true" /> Agenda
        </button>
        <button type="button" aria-pressed={section === "mural"} onClick={() => {
          if (section !== "mural") setRequest({ offset: 0 });
          setSection("mural");
        }}>
          <Images size={18} aria-hidden="true" /> Mural
        </button>
        <button type="button" aria-pressed={section === "arcade"} onClick={() => {
          setArcadeOpened(true);
          setSection("arcade");
        }}>
          <Gamepad2 size={18} aria-hidden="true" /> Arcade
        </button>
      </nav>
      {arcadeOpened && <div hidden={section !== "arcade"}>
        <Arcade demo={!clientId} visible={section === "arcade"} onBalance={updateBalance} />
      </div>}
      <div hidden={section !== "booking"}><Booking api={api} /></div>
      {section === "mural" && (
        <>
          <Mural ranking={ranking} loading={rankingBusy && !ranking.length} error={rankingError}
            loadingMore={rankingBusy && Boolean(ranking.length)} hasMore={hasMore}
            onLoadMore={() => { if (!rankingBusy) setRequest({ offset: rankingOffset }); }} />
          {rankingError && <button type="button" className="secondary mt-3"
            onClick={() => setRequest({ offset: request.offset })}>Tentar classificação novamente</button>}
        </>
      )}
    </div>
  );
}
