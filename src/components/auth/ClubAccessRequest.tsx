import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase/browser";

export function ClubAccessRequest() {
  const [pending, setPending] = useState<boolean>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const result = await getSupabase()?.rpc("has_pending_club_access_request");
        if (!result || result.error) throw new Error();
        if (active) setPending(result.data);
      } catch {
        if (active) {
          setPending(false);
          setError("Não foi possível consultar a solicitação.");
        }
      }
    })();
    return () => { active = false; };
  }, []);

  async function requestAccess() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await getSupabase()?.rpc("request_club_access");
      if (!result || result.error) throw new Error();
      setPending(result.data);
      if (!result.data) setError("Seu acesso já foi liberado. Toque em Verificar acesso.");
    } catch { setError("Não foi possível enviar a solicitação. Tente novamente."); }
    finally { setBusy(false); }
  }

  return <div className="space-y-2">
    {pending === undefined ? <p role="status">Consultando solicitação…</p>
      : pending ? <p role="status">Solicitação enviada. Aguarde a aprovação da barbearia.</p>
        : <button type="button" className="primary w-full" disabled={busy} onClick={() => void requestAccess()}>
          {busy ? "Enviando…" : "Solicitar acesso"}
        </button>}
    {error && <p className="error" role="alert">{error}</p>}
  </div>;
}
