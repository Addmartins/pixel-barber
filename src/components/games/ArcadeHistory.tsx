import { useRef, useState } from "react";
import { History } from "lucide-react";
import { getArcadeHistory } from "@/lib/games/client";
import type { ArcadeHistoryEntry, Difficulty, GameCode } from "@/lib/games/types";

const pageSize = 20;
const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Recife" });
const number = new Intl.NumberFormat("pt-BR");

export function ArcadeHistory({ demo, demoEntries, games, levels }: {
  demo: boolean;
  demoEntries: ArcadeHistoryEntry[];
  games: readonly { code: GameCode; title: string }[];
  levels: Record<Difficulty, { title: string }>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const fetching = useRef(false);
  const [entries, setEntries] = useState<ArcadeHistoryEntry[]>([]);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [failedCursor, setFailedCursor] = useState<ArcadeHistoryEntry>();

  async function load(before?: ArcadeHistoryEntry) {
    if (demo || fetching.current) return;
    fetching.current = true;
    setLoading(true);
    setError(false);
    try {
      const rows = await getArcadeHistory(pageSize + 1, before);
      setEntries((current) => before ? [...current, ...rows.slice(0, pageSize)] : rows.slice(0, pageSize));
      setMore(rows.length > pageSize);
    } catch {
      setFailedCursor(before);
      setError(true);
    } finally {
      fetching.current = false;
      setLoading(false);
    }
  }

  const history = demo ? demoEntries : entries;
  return (
    <>
      <button type="button" aria-haspopup="dialog" className="secondary flex items-center gap-2"
        onClick={() => { dialog.current?.showModal(); void load(); }}>
        <History size={18} aria-hidden="true" /> Histórico de partidas
      </button>
      <dialog ref={dialog} className="wallet-dialog" aria-label="Histórico de partidas">
        <header className="wallet-dialog-header">
          <h2>Histórico de partidas</h2>
          <form method="dialog"><button className="secondary">Fechar</button></form>
        </header>
        {demo && <p className="muted text-sm">Partidas desta sessão de demonstração.</p>}
        {!loading && !error && !history.length && <p className="muted">Nenhuma partida concluída.</p>}
        {history.length > 0 && <ul className="space-y-3">{history.map((entry) => (
          <li className="space-y-1 border-t border-white/10 pt-3" key={entry.id}>
            <strong>{games.find((game) => game.code === entry.game_code)?.title ?? entry.game_code}</strong>
            <p className="muted text-sm">{levels[entry.difficulty]?.title} · {entry.won ? "Vitória" : "Derrota"} · {entry.duration_seconds} s</p>
            <p className="text-sm">{entry.display_score === null ? "Placar indisponível" : `Placar ${number.format(entry.display_score)}`} · {number.format(entry.points_awarded)} pts creditados</p>
            <time className="muted text-xs" dateTime={entry.created_at}>{date.format(new Date(entry.created_at))}</time>
          </li>
        ))}</ul>}
        {loading && <p role="status">Carregando partidas…</p>}
        {error && <p className="error" role="alert">Não foi possível carregar o histórico.</p>}
        {error ? <button type="button" className="secondary" onClick={() => void load(failedCursor)}>Tentar novamente</button>
          : more && <button type="button" className="secondary" disabled={loading} onClick={() => void load(entries.at(-1))}>Ver mais partidas</button>}
      </dialog>
    </>
  );
}
