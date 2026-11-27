"use client";

import { useEffect, useState, type FormEvent } from "react";
import { getSupabase } from "@/lib/supabase/browser";

type Shop = { id: string; name: string };

export function PartnerScreen() {
  const db = getSupabase();
  const [account, setAccount] = useState<string>();
  const [inviteId, setInviteId] = useState("");
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    setInviteId(new URLSearchParams(window.location.search).get("convite") ?? "");
    if (!db) return;
    const { data: { subscription } } = db.auth.onAuthStateChange((_event, session) => {
      setAccount(session?.user.id ?? "");
    });
    return () => subscription.unsubscribe();
  }, [db]);

  useEffect(() => {
    if (!db || !account) return;
    let active = true;
    setShops([]);
    setLoading(true);
    void db.from("partner_barbershops").select("id,name").order("name").then(({ data, error }) => {
      if (!active) return;
      if (error) setError("Não foi possível carregar suas barbearias.");
      else setShops(data);
      setLoading(false);
    });
    return () => { active = false; };
  }, [db, account, revision]);

  async function save(event: FormEvent<HTMLFormElement>, shopId?: string) {
    event.preventDefault();
    if (!db || busy || !account) return;
    const name = String(new FormData(event.currentTarget).get("name") ?? "").trim();
    if (!name) {
      setError("Informe o nome da barbearia.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { error } = shopId
        ? await db.from("partner_barbershops").update({ name }).eq("id", shopId).select("id").single()
        : await db.rpc("accept_partner_invite", { p_invite_id: inviteId, p_name: name });
      if (error) {
        setError(["PT404", "PT410"].includes(error.code) ? error.message : "Não foi possível salvar a barbearia.");
        return;
      }
      if (!shopId) {
        setInviteId("");
        window.history.replaceState(null, "", window.location.pathname);
      }
      setRevision((current) => current + 1);
    } catch {
      setError("A conexão falhou. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="device-shell">
    <div className="shell-content space-y-4">
      <header className="masthead"><h1>Minha Barbearia</h1></header>
      {!db && <p role="alert">O painel está indisponível.</p>}
      {db && account === undefined && <p role="status">Verificando sessão…</p>}
      {account === "" && <section className="card-modern space-y-2">
        <p>Entre ou confirme seu celular no Pixel Barber com o número que recebeu o convite. Depois, abra este link novamente.</p>
        <a href="/" className="underline">Entrar no Pixel Barber</a>
      </section>}
      {account && <>
        {error && <p role="alert">{error}</p>}
        {inviteId && <form className="card-modern space-y-3" onSubmit={save}>
          <h2>Cadastrar barbearia</h2>
          <label className="field">Nome da barbearia<input name="name" required maxLength={100} /></label>
          <button type="submit" disabled={busy}>Aceitar convite e cadastrar</button>
        </form>}
        {loading && <p role="status">Carregando barbearias…</p>}
        {!loading && !shops.length && !inviteId && !error && <p>Abra o convite enviado pela Pixel para cadastrar sua barbearia.</p>}
        {!loading && shops.map((shop) => <form className="card-modern space-y-3" key={shop.id}
          onSubmit={(event) => void save(event, shop.id)}>
          <label className="field">Nome da barbearia<input name="name" defaultValue={shop.name} required maxLength={100} /></label>
          <button type="submit" disabled={busy}>Salvar</button>
        </form>)}
      </>}
    </div>
  </main>;
}
