import { useEffect, useState, type FormEvent } from "react";
import { NoticePost } from "./NoticePost";
import { type ClubNotice } from "@/lib/club";
import { getSupabase } from "@/lib/supabase/browser";

export function NoticeBoard({ clientId }: { clientId: string }) {
  const [notices, setNotices] = useState<ClubNotice[]>();
  const [readError, setReadError] = useState(false);
  const [feedback, setFeedback] = useState<{ error: boolean; text: string }>();
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const result = await getSupabase()?.rpc("get_mural_notices");
        if (!active) return;
        if (!result || result.error) setReadError(true);
        else setNotices(result.data);
      } catch { if (active) setReadError(true); }
    })();
    return () => { active = false; };
  }, []);

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
    <section className="card-modern mb-4 space-y-4">
      <h2>Quadro de avisos</h2>
      {readError ? <p className="error" role="alert">Não foi possível carregar os avisos.</p>
        : !notices ? <p role="status" className="muted">Carregando avisos…</p>
        : !notices.length ? <p className="muted">Nenhum aviso publicado.</p>
        : notices.map((notice) => (
          <article className="border-t border-white/10 pt-3" key={notice.id}>
            <NoticePost notice={notice} />
          </article>
        ))}
      <form className="space-y-2 border-t border-white/10 pt-3" onSubmit={send}>
        <label className="field">Envie uma sugestão <textarea name="suggestion" rows={2} maxLength={1000} required /></label>
        <button type="submit" className="secondary" disabled={sending}>{sending ? "Enviando…" : "Enviar sugestão"}</button>
        {feedback && <p className={feedback.error ? "error" : "muted"} role={feedback.error ? "alert" : "status"}>{feedback.text}</p>}
      </form>
    </section>
  );
}
