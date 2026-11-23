import { useEffect, useRef, useState, type FormEvent } from "react";
import { NoticePost } from "./NoticePost";
import { CutMuralTitle } from "@/components/CutMuralTitle";
import { type ClubNotice } from "@/lib/club";
import { getSupabase } from "@/lib/supabase/browser";

export function NoticeBoard({ clientId }: { clientId: string }) {
  const [notices, setNotices] = useState<ClubNotice[]>();
  const [albums, setAlbums] = useState<ClubNotice[]>();
  const [albumPage, setAlbumPage] = useState(0);
  const [hasMoreAlbums, setHasMoreAlbums] = useState(false);
  const [albumError, setAlbumError] = useState(false);
  const [selectedAlbum, setSelectedAlbum] = useState<ClubNotice>();
  const dialog = useRef<HTMLDialogElement>(null);
  const [readError, setReadError] = useState(false);
  const [feedback, setFeedback] = useState<{ error: boolean; text: string }>();
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const result = await getSupabase()?.rpc("get_club_posts", { p_portfolio: false, p_limit: 2 });
        if (!active) return;
        if (!result || result.error) setReadError(true);
        else setNotices(result.data);
      } catch { if (active) setReadError(true); }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setAlbums(undefined);
    setAlbumError(false);
    void (async () => {
      try {
        const result = await getSupabase()?.rpc("get_club_posts", {
          p_portfolio: true, p_limit: 5, p_offset: albumPage * 4,
        });
        if (!active) return;
        if (!result || result.error) throw new Error();
        setAlbums(result.data.slice(0, 4));
        setHasMoreAlbums(result.data.length > 4);
      } catch { if (active) setAlbumError(true); }
    })();
    return () => { active = false; };
  }, [albumPage]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    const form = event.currentTarget;
    const body = String(new FormData(form).get("suggestion") ?? "").trim();
    if (!body) {
      setFeedback({ error: true, text: "Escreva uma sugestão antes de enviar." });
      return;
    }
    setSending(true);
    setFeedback(undefined);
    try {
      const result = await getSupabase()?.from("club_suggestions").insert({ client_id: clientId, body });
      if (!result || result.error) throw new Error();
      form.reset();
      setFeedback({ error: false, text: "Sugestão enviada à barbearia." });
    } catch { setFeedback({ error: true, text: "Não foi possível enviar sua sugestão. Tente novamente." }); }
    finally { setSending(false); }
  }

  return (
    <div className="mb-4 space-y-4">
      <section className="card-modern space-y-3" aria-labelledby="notice-board-title">
        <h2 id="notice-board-title">Quadro de avisos</h2>
        {readError ? <p className="error" role="alert">Não foi possível carregar os avisos.</p>
          : !notices ? <p role="status" className="muted">Carregando avisos…</p>
          : !notices.length ? <p className="muted">Nenhum aviso publicado.</p>
          : <div className="grid grid-cols-2 gap-2">{notices.map((notice) => (
            <article className="min-w-0 break-words rounded-lg border border-white/10 p-2 sm:p-3" key={notice.id}>
              <NoticePost notice={notice} />
            </article>
          ))}</div>}
      </section>
      <section className="card-modern space-y-3" aria-labelledby="portfolio-title">
        <h2 id="portfolio-title"><CutMuralTitle /></h2>
        {albumError ? <p className="error" role="alert">Não foi possível carregar os álbuns.</p>
          : !albums ? <p className="muted" role="status">Carregando álbuns…</p>
          : !albums.length ? <p className="muted">Nenhum álbum publicado.</p>
          : <div className="grid grid-cols-2 gap-2">{albums.map((album) => (
            <article className="min-w-0 break-words rounded-lg border border-white/10 p-2 sm:p-3" key={album.id}>
              <NoticePost notice={album} cover />
              <button type="button" className="secondary mt-2 w-full text-sm" aria-haspopup="dialog"
                aria-label={`Abrir álbum ${album.title}`} onClick={() => {
                  setSelectedAlbum(album);
                  dialog.current?.showModal();
                }}>Ver álbum</button>
            </article>
          ))}</div>}
        {albums && (albumPage > 0 || hasMoreAlbums) && <div className="flex flex-wrap gap-2">
          {albumPage > 0 && <button type="button" className="secondary" onClick={() => setAlbumPage(albumPage - 1)}>Álbuns anteriores</button>}
          {hasMoreAlbums && <button type="button" className="secondary" onClick={() => setAlbumPage(albumPage + 1)}>Mais álbuns</button>}
        </div>}
        <dialog ref={dialog} className="wallet-dialog" aria-label={selectedAlbum?.title ?? "Álbum do mural de cortes"} onClose={() => setSelectedAlbum(undefined)}>
          <button type="button" className="secondary justify-self-end" onClick={() => dialog.current?.close()}>Fechar</button>
          {selectedAlbum && <NoticePost notice={selectedAlbum} />}
        </dialog>
      </section>
      <form className="card-modern space-y-2" onSubmit={send}>
        <label className="field">Envie uma sugestão <textarea name="suggestion" rows={2} maxLength={1000} required /></label>
        <button type="submit" className="secondary" disabled={sending}>{sending ? "Enviando…" : "Enviar sugestão"}</button>
        {feedback && <p className={feedback.error ? "error" : "muted"} role={feedback.error ? "alert" : "status"}>{feedback.text}</p>}
      </form>
    </div>
  );
}
