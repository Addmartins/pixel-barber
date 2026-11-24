import { useEffect, useState } from "react";
import { clubDateTime } from "@/lib/club";
import { getSupabase, type Database } from "@/lib/supabase/browser";

type Request = Database["public"]["Functions"]["get_club_access_requests"]["Returns"][number];

export function ClubAccessRequests() {
  const [requests, setRequests] = useState<Request[]>();
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ error: boolean; text: string }>();

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const result = await getSupabase()?.rpc("get_club_access_requests");
        if (!result || result.error) throw new Error();
        if (active) setRequests(result.data);
      } catch {
        if (active) setFeedback({ error: true, text: "Não foi possível carregar as solicitações. Tente atualizar." });
      }
    })();
    return () => { active = false; };
  }, [revision]);

  async function approve(request: Request) {
    if (busy) return;
    setBusy(true);
    setFeedback(undefined);
    try {
      const result = await getSupabase()?.rpc("approve_club_access", { p_user_id: request.user_id });
      if (!result || result.error) throw new Error();
      setRequests((current) => current?.filter(({ user_id }) => user_id !== request.user_id));
      setFeedback({ error: false, text: result.data ? `Acesso de ${request.nome} liberado.` : "Esta solicitação não está mais pendente." });
      setRevision((current) => current + 1);
    } catch { setFeedback({ error: true, text: "Não foi possível aceitar a solicitação. Tente novamente." }); }
    finally { setBusy(false); }
  }

  return <section className="card-modern space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2>Solicitações de acesso</h2>
      <button type="button" className="secondary" disabled={busy} onClick={() => {
        setFeedback(undefined);
        setRevision((current) => current + 1);
      }}>Atualizar</button>
    </div>
    {feedback && <p className={feedback.error ? "error" : "muted"} role={feedback.error ? "alert" : "status"}>{feedback.text}</p>}
    {!requests ? !feedback && <p role="status">Carregando solicitações…</p>
      : !requests.length ? <p className="muted">Nenhuma solicitação pendente.</p>
        : <ul className="space-y-3">{requests.map((request) => (
          <li key={request.user_id} className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3">
            <div>
              <p><strong>{request.nome}</strong>{request.phone_ending && ` · celular final ${request.phone_ending}`}</p>
              <time className="muted text-sm" dateTime={request.requested_at}>{clubDateTime.format(new Date(request.requested_at))}</time>
            </div>
            <button type="button" className="primary" disabled={busy} onClick={() => void approve(request)}>Aceitar solicitação</button>
          </li>
        ))}</ul>}
  </section>;
}
