import { useState, type FormEvent } from "react";
import { normalizePhone } from "@/lib/phone";
import { getSupabase } from "@/lib/supabase/browser";

export function PartnerInviteForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const db = getSupabase();
    if (!db || busy) return;
    setError("");
    setInviteUrl("");
    const phone = normalizePhone(String(new FormData(event.currentTarget).get("phone") ?? ""));
    if (!phone) {
      setError("Informe o celular cadastrado com DDD.");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await db.rpc("create_partner_invite", { p_phone: phone });
      if (error || !data) {
        setError(error?.code === "PT404" ? error.message : "Não foi possível gerar o convite.");
        return;
      }
      const url = new URL("/minha-barbearia", process.env.NEXT_PUBLIC_BACKEND_ORIGIN || window.location.origin);
      url.searchParams.set("convite", data);
      setInviteUrl(url.href);
    } catch {
      setError("A conexão falhou. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="card-modern space-y-3">
    <h2>Convidar barbearia</h2>
    <form className="space-y-2" onSubmit={submit}>
      <label className="field">Celular confirmado do proprietário<input name="phone" type="tel" required /></label>
      <button type="submit" disabled={busy}>Gerar convite</button>
    </form>
    {error && <p role="alert">{error}</p>}
    {inviteUrl && <label className="field">Link para enviar ao proprietário<input readOnly value={inviteUrl}
      onFocus={(event) => event.currentTarget.select()} /></label>}
  </section>;
}
