"use client";

import { useEffect, useRef, useState } from "react";
import { Coins, Gift } from "lucide-react";
import { loginDay, type DailyLogin } from "@/lib/daily-login";
import { deviceApi } from "@/lib/device/api";
import { getSupabase, type PointEntry } from "@/lib/supabase/browser";

const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Recife" });
const number = new Intl.NumberFormat("pt-BR");
type Bonus = DailyLogin & { multiplier: number };
type Entry = Pick<PointEntry, "id" | "quantidade" | "descricao" | "created_at">;
const pageSize = 20;

export function WalletDialogs({ userId, balance }: { userId?: string; balance: number }) {
  const statement = useRef<HTMLDialogElement>(null);
  const popup = useRef<HTMLDialogElement>(null);
  const opened = useRef<string | undefined>(undefined);
  const [bonus, setBonus] = useState<Bonus>();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [more, setMore] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    let pending = false;
    let checked: string | undefined;

    async function check() {
      const day = loginDay();
      if (!active || pending || day === checked || document.hidden) return;
      pending = true;
      try {
        const { data } = await getSupabase()?.auth.getSession() ?? {};
        if (data?.session?.user.id !== userId || !data?.session) return;
        const response = await fetch(deviceApi("/api/login-bonus"), {
          method: "POST", headers: { authorization: `Bearer ${data.session.access_token}` },
        });
        if (!response.ok || !active) return;
        const daily: Bonus = await response.json();
        if (!active) return;
        checked = daily.day;
        const key = `pixel-barber:daily-popup:${userId}`;
        if (opened.current === daily.day) return;
        try {
          if (localStorage.getItem(key) === daily.day) return;
        } catch { /* The popup still works without browser storage. */ }
        opened.current = daily.day;
        setBonus(daily);
      } catch {
        // Another foreground check retries without interrupting sign-in.
      } finally { pending = false; }
    }

    void check();
    const timer = window.setInterval(check, 60_000);
    document.addEventListener("visibilitychange", check);
    return () => {
      active = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, [userId]);

  useEffect(() => {
    if (bonus && !statement.current?.open && !popup.current?.open) popup.current?.showModal();
  }, [bonus]);

  function dismissBonus() {
    if (bonus && userId) {
      try { localStorage.setItem(`pixel-barber:daily-popup:${userId}`, bonus.day); } catch { /* Optional storage. */ }
    }
    setBonus(undefined);
  }

  async function load(offset: number) {
    if (!userId || loading) return;
    const db = getSupabase();
    setLoading(true);
    setError(false);
    try {
      if (!db) throw new Error();
      const { data, error: readError } = await db.from("point_ledger")
        .select("id,quantidade,descricao,created_at").eq("client_id", userId)
        .order("created_at", { ascending: false }).order("id", { ascending: false }).range(offset, offset + pageSize);
      if (readError) throw readError;
      setMore(data.length > pageSize);
      setEntries(previous => {
        const page = data.slice(0, pageSize);
        return offset ? [...previous, ...page.filter(entry => !previous.some(row => row.id === entry.id))] : page;
      });
    } catch { setError(true); }
    finally { setLoading(false); }
  }

  return (
    <>
      <button type="button" className="wallet-badge" aria-haspopup="dialog"
        aria-label={`${number.format(balance)} pontos. Ver extrato`}
        onClick={() => { statement.current?.showModal(); void load(0); }}>
        <Coins size={16} aria-hidden="true" />
        <strong>{number.format(balance)} pts</strong>
      </button>

      <dialog ref={statement} className="wallet-dialog" aria-labelledby="wallet-title"
        onClose={() => { if (bonus && !popup.current?.open) popup.current?.showModal(); }}>
        <header className="wallet-dialog-header">
          <h2 id="wallet-title">Extrato de pontos</h2>
          <form method="dialog"><button className="secondary">Fechar</button></form>
        </header>
        <p className="muted">Saldo atual <strong>{number.format(balance)} pts</strong></p>
        {!userId && <p className="muted">O extrato está disponível para contas cadastradas.</p>}
        {userId && !loading && !error && !entries.length && <p className="muted">Nenhuma movimentação ainda.</p>}
        {entries.length > 0 && <ul className="wallet-entries">
          {entries.map(entry => (
            <li key={entry.id}>
              <div><strong>{entry.descricao}</strong><time dateTime={entry.created_at}>{date.format(new Date(entry.created_at))}</time></div>
              <strong data-debit={entry.quantidade < 0}>{entry.quantidade > 0 ? "+" : ""}{number.format(entry.quantidade)}</strong>
            </li>
          ))}
        </ul>}
        {loading && <p role="status">Carregando extrato…</p>}
        {error && <p role="alert" className="error">Não foi possível carregar o extrato.</p>}
        {(more || error) && <button type="button" className="secondary" disabled={loading}
          onClick={() => void load(error ? 0 : entries.length)}>{error ? "Tentar novamente" : "Ver mais"}</button>}
      </dialog>

      <dialog ref={popup} className="wallet-dialog daily-login-dialog" aria-labelledby="daily-login-title" onClose={dismissBonus}>
        {bonus && <>
          <Gift size={28} aria-hidden="true" />
          <h2 id="daily-login-title">Bônus de login diário</h2>
          <strong className="daily-login-multiplier">{number.format(bonus.multiplier)}×</strong>
          <p>{bonus.days} {bonus.days === 1 ? "dia consecutivo" : "dias consecutivos"}</p>
          <p className="muted">O multiplicador vale para os créditos do Pixel Boy de hoje. A sequência sobe 0,1× por dia, até 1,5×.</p>
          <form method="dialog"><button className="primary w-full">Continuar</button></form>
        </>}
      </dialog>
    </>
  );
}
