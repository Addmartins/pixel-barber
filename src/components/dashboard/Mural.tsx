"use client";

import { useId, useRef } from "react";
import { AvatarRenderer } from "@/components/avatar/AvatarRenderer";
import { avatars } from "@/lib/avatars";
import { withShirtNumber } from "@/lib/store";
import type { GameCode } from "@/lib/games/types";
import type { RankingEntry } from "@/lib/supabase/browser";
import styles from "./mural.module.css";

const medals = [
  { color: "#ffd77d", pixels: ["x..x..x", "xx.x.xx", "xxxxxxx", ".xxxxx.", ".xxxxx."] },
  { color: "#d3e2f2", pixels: [".x...x.", "..x.x..", "..xxx..", ".xxxxx.", "..xxx.."] },
  { color: "#e6a070", pixels: [".x...x.", "..x.x..", "..xxx..", ".xxxxx.", "..xxx.."] },
];

function PixelGrid({ pixels, colors, className }: {
  pixels: readonly string[];
  colors: Partial<Record<string, string>>;
  className: string;
}) {
  return (
    <span className={className} aria-hidden="true" style={{ gridTemplateColumns: `repeat(${pixels[0].length}, 1fr)` }}>
      {pixels.flatMap((row, y) => Array.from(row, (pixel, x) => (
        <span key={`${y}-${x}`} style={{ backgroundColor: colors[pixel] }} />
      )))}
    </span>
  );
}

function entryName(entry: RankingEntry) {
  return entry.display_name || avatars.find((avatar) => avatar.id === entry.avatar_skin)?.name || "Avatar";
}

const masterBadges: Record<GameCode, string> = {
  NAVALHA_RUSH: "Mestre no Navalha Rush",
  BARBA_FIGHTER: "Mestre no Barba Fighter II",
  TORRE_FADE: "Mestre na Torre do Fade",
  ESCALADA_KONG: "Mestre na Escalada da Pomada",
  BIGODE_SNAKE: "Mestre no Bigode Snake",
  BARBER_VALLEY: "Mestre no Barber Valley",
  ORBITA_PIXEL: "Mestre no Órbita Pixel",
};

function MasterBadges({ games }: { games?: GameCode[] }) {
  if (!games?.length) return null;
  return <ul className={styles.badges} aria-label="Conquistas no Arcade">
    {games.map((game) => masterBadges[game] && <li key={game}>{masterBadges[game]}</li>)}
  </ul>;
}

const formatPoints = new Intl.NumberFormat("pt-BR");

export function Mural({ ranking, loading = false, error, hasMore = false, loadingMore = false, onLoadMore }: {
  ranking: RankingEntry[];
  loading?: boolean;
  error?: string;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
}) {
  const muralId = useId();
  const rankingId = useId();
  const dialogTitleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const openButton = useRef<HTMLButtonElement>(null);

  return (
    <div className={styles.mural}>
      <section aria-labelledby={muralId}>
        <h2 id={muralId}>Mural de cortes</h2>
        <ul className={styles.gallery}>
          {avatars.map(({ id, name, backdrop }) => (
            <li key={id} className={styles.cut}>
              <div className={styles.portrait} style={{ backgroundColor: backdrop }}>
                <AvatarRenderer skinId={id} size={64} />
              </div>
              <span className={styles.cutName}>{name}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby={rankingId}>
        <h2 id={rankingId}>Ranking semanal · Top 3</h2>
        {error && <p className="error mt-2" role="alert">{error}</p>}
        {ranking.length === 0 ? (
          !error && <p className="muted mt-2" role="status">{loading ? "Carregando o ranking…" : "Ainda não há pontos no ranking desta semana."}</p>
        ) : (
          <>
            <ol className={styles.podium}>
              {ranking.slice(0, 3).map((entry, index) => {
                const medal = medals[index];
                return (
                  <li key={entry.position} className={styles.podiumEntry}>
                    <PixelGrid pixels={medal.pixels} colors={{ x: medal.color }} className={styles.medal} />
                    <AvatarRenderer skinId={entry.avatar_skin} cosmetics={entry.equipped_cosmetics?.map(code => withShirtNumber(code, entry.shirt_number))} />
                    <div className={styles.podiumLabel}>
                      <span className={styles.position} style={{ color: medal.color }}>{entry.position}º</span>
                      <strong>{entryName(entry)}</strong>
                      <small>{formatPoints.format(entry.points_balance)} pts</small>
                      <MasterBadges games={entry.mastered_games} />
                    </div>
                  </li>
                );
              })}
            </ol>
            <button ref={openButton} type="button" className="secondary w-full" onClick={() => dialog.current?.showModal()}>
              Ver classificação completa
            </button>
          </>
        )}

        <dialog ref={dialog} className={styles.dialog} aria-labelledby={dialogTitleId}
          onClose={() => openButton.current?.focus()}>
          <header className={styles.dialogHeader}>
            <h2 id={dialogTitleId}>Classificação semanal</h2>
            <form method="dialog">
              <button type="submit" className="secondary" autoFocus>Fechar</button>
            </form>
          </header>
          <div className={styles.tableWrap} tabIndex={0} role="region" aria-label="Tabela de classificação">
            <table className={styles.table}>
              <thead><tr><th scope="col">Lugar</th><th scope="col">Avatar</th><th scope="col">Pontos</th></tr></thead>
              <tbody>
                {ranking.map((entry) => (
                  <tr key={entry.position}>
                    <th scope="row">{entry.position}º</th>
                    <td>
                      <span className={styles.tableAvatar}><AvatarRenderer size={32} skinId={entry.avatar_skin} cosmetics={entry.equipped_cosmetics?.map(code => withShirtNumber(code, entry.shirt_number))} />{entryName(entry)}</span>
                      <MasterBadges games={entry.mastered_games} />
                    </td>
                    <td>{formatPoints.format(entry.points_balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {loadingMore && <p className="muted mt-2" role="status">Carregando a classificação…</p>}
          {error && <p className="error mt-2" role="alert">{error}</p>}
          {hasMore && onLoadMore && (
            <button type="button" className="secondary mt-3 w-full" disabled={loadingMore} onClick={onLoadMore}>
              Ver mais posições
            </button>
          )}
        </dialog>
      </section>
    </div>
  );
}
