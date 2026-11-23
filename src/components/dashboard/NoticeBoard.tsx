import { UserRound } from "lucide-react";
import type { Barber } from "@/lib/booking";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { NoticePost } from "./NoticePost";
import { CutMuralTitle } from "@/components/CutMuralTitle";
import { type ClubNotice } from "@/lib/club";
import { getSupabase } from "@/lib/supabase/browser";

type MuralBarber = Pick<Barber, "id" | "nome" | "foto_pixel">;
const albumsPerBarber = 2;

function AlbumColumn({ barber, openAlbum }: { barber?: MuralBarber; openAlbum: (album: ClubNotice) => void }) {
  const [albums, setAlbums] = useState<ClubNotice[]>();
  const [page, setPage] = useState(0);
  const [failed, setFailed] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  const barberId = barber?.id ?? null;

  useEffect(() => {
    let active = true;
    setAlbums(undefined);
    setFailed(false);
    void (async () => {
      try {
        const result = await getSupabase()?.rpc("get_cut_albums", {
          p_barber_id: barberId, p_limit: albumsPerBarber + 1, p_offset: page * albumsPerBarber,
        });
        if (!result || result.error) throw new Error();
        if (active) setAlbums(result.data);
      } catch { if (active) setFailed(true); }
    })();
    return () => { active = false; };
  }, [barberId, page]);

  if (!barber && !failed && !albums?.length && page === 0) return null;
  return (
    <section className="min-w-0 space-y-3" aria-label={barber?.nome ?? "Álbuns anteriores sem barbeiro vinculado"}>
      <header className="flex flex-col items-center gap-2 text-center">
        {barber && <div className="grid size-14 place-items-center overflow-hidden rounded-full border border-white/20 bg-white/5">
          {barber.foto_pixel && !photoFailed
            // eslint-disable-next-line @next/next/no-img-element
            ? <img className="size-full object-cover" src={barber.foto_pixel} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setPhotoFailed(true)} />
            : <UserRound size={24} aria-hidden="true" />}
        </div>}
        <h3 className="w-full break-words text-sm font-semibold">{barber?.nome ?? "Álbuns anteriores"}</h3>
      </header>
      {failed ? <p className="error text-sm" role="alert">Não foi possível carregar os álbuns.</p>
        : !albums ? <p className="muted text-sm" role="status">Carregando álbuns…</p>
        : !albums.length ? <p className="muted text-sm">Nenhum álbum publicado.</p>
        : albums.slice(0, albumsPerBarber).map((album) => (
          <article className="min-w-0 break-words rounded-lg border border-white/10 p-2 sm:p-3" key={album.id}>
            <NoticePost notice={album} cover />
            <button type="button" className="secondary mt-2 w-full text-sm" aria-haspopup="dialog"
              aria-label={`Abrir álbum ${album.title}`} onClick={() => openAlbum(album)}>Ver álbum</button>
          </article>
        ))}
      {(page > 0 || (albums?.length ?? 0) > albumsPerBarber) && <div className="flex flex-wrap justify-center gap-2">
        {page > 0 && <button type="button" className="secondary text-sm" onClick={() => setPage(page - 1)}>Anterior</button>}
        {(albums?.length ?? 0) > albumsPerBarber && <button type="button" className="secondary text-sm" onClick={() => setPage(page + 1)}>Mais álbuns</button>}
      </div>}
    </section>
  );
}

export function NoticeBoard({ clientId }: { clientId: string }) {
  const [notices, setNotices] = useState<ClubNotice[]>();
  const [barbers, setBarbers] = useState<MuralBarber[]>();
  const [barberError, setBarberError] = useState(false);
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
    void (async () => {
      try {
        const result = await getSupabase()?.from("barbers").select("id,nome,foto_pixel").order("nome").order("id");
        if (!result || result.error) throw new Error();
        if (active) setBarbers(result.data);
      } catch { if (active) setBarberError(true); }
    })();
    return () => { active = false; };
  }, []);

  function openAlbum(album: ClubNotice) {
    setSelectedAlbum(album);
    dialog.current?.showModal();
  }

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
        {barberError ? <p className="error" role="alert">Não foi possível carregar os barbeiros.</p>
          : !barbers ? <p className="muted" role="status">Carregando barbeiros…</p>
          : !barbers.length ? <p className="muted">Nenhum barbeiro cadastrado.</p>
          : <div className="grid grid-cols-2 gap-2 sm:gap-4">
            {barbers.map((barber) => <AlbumColumn key={barber.id} barber={barber} openAlbum={openAlbum} />)}
          </div>}
        <AlbumColumn openAlbum={openAlbum} />
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
