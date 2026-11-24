"use client";

import { useEffect, useState, type FormEvent } from "react";
import { getSupabase } from "@/lib/supabase/browser";
import { normalizePhone } from "@/lib/phone";
import { PasswordReset } from "@/components/auth/PasswordReset";
import { ClubAdmin } from "./ClubAdmin";

type Access = "loading" | "signed-out" | "allowed" | "denied" | "error";

export function AdminScreen() {
  const [access, setAccess] = useState<Access>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [recovering, setRecovering] = useState(false);
  const [passwordChanged, setPasswordChanged] = useState(false);
  const [accountId, setAccountId] = useState<string>();
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const db = getSupabase();
    if (!db) {
      setAccess("error");
      return;
    }

    const { data: { subscription } } = db.auth.onAuthStateChange((_event, session) => {
      setAccountId(session?.user.id ?? "");
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (accountId === undefined) return;
    if (!accountId) {
      setAccess("signed-out");
      return;
    }
    let active = true;
    setAccess("loading");
    void (async () => {
      try {
        const result = await getSupabase()?.rpc("is_club_admin");
        if (active) setAccess(!result || result.error ? "error" : result.data ? "allowed" : "denied");
      } catch {
        if (active) setAccess("error");
      }
    })();
    return () => { active = false; };
  }, [accountId, retry]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const phoneInput = form.elements.namedItem("phone") as HTMLInputElement;
    const phone = normalizePhone(phoneInput.value);
    if (!phone) {
      setError("Informe um celular válido com DDD.");
      return;
    }
    setBusy(true);
    setError("");
    phoneInput.value = phone;
    try {
      const result = await getSupabase()?.auth.signInWithPassword({ phone, password: String(fields.get("password") ?? "") });
      if (!result || result.error) {
        setError(result?.error?.code === "phone_not_confirmed"
          ? "Confirme o celular na tela inicial antes de entrar na administração."
          : "Não foi possível entrar. Confira o celular e a senha.");
      }
    } catch { setError("A conexão falhou. Tente novamente."); }
    finally { setBusy(false); }
  }

  async function signOut() {
    setBusy(true);
    setError("");
    try {
      const result = await getSupabase()?.auth.signOut({ scope: "local" });
      if (!result || result.error) setError("Não foi possível sair. Tente novamente.");
    } catch { setError("A conexão falhou. Tente novamente."); }
    finally { setBusy(false); }
  }

  return (
    <main className="device-shell">
      <div className="shell-content space-y-4">
        <header className="masthead flex flex-wrap items-center justify-between gap-3">
          <div><h1>PIXEL<span> BARBER</span></h1><p>Administração</p></div>
          <div className="flex flex-wrap items-center gap-2">
            <a href="/" className="text-sm underline">Área do cliente</a>
            {accountId && <button className="secondary" type="button" onClick={() => void signOut()} disabled={busy}>Sair</button>}
          </div>
        </header>

        {access === "loading" && <p role="status">Verificando acesso…</p>}
        {access === "error" && <div className="space-y-2"><p role="alert">Não foi possível verificar o acesso administrativo.</p>
          {accountId && <button className="secondary" type="button" onClick={() => setRetry(retry + 1)}>Tentar novamente</button>}
        </div>}
        {access === "denied" && <p role="alert">Esta conta não tem acesso administrativo.</p>}
        {access === "signed-out" && recovering && <div className="card-modern">
          <PasswordReset initialPhone="" onCancel={() => setRecovering(false)} onSuccess={() => {
            setRecovering(false);
            setPasswordChanged(true);
          }} />
        </div>}
        {access === "signed-out" && !recovering && (
          <form method="post" className="card-modern space-y-4" onSubmit={signIn}>
            <h2>Entrar na administração</h2>
            {passwordChanged && <p role="status">Senha alterada. Entre com a nova senha.</p>}
            <label className="field">Celular <input name="phone" type="text" inputMode="tel" autoComplete="username" maxLength={30} required /></label>
            <label className="field">Senha <input name="password" type="password" autoComplete="current-password" required /></label>
            <button className="primary w-full" disabled={busy}>{busy ? "Entrando…" : "Entrar"}</button>
            <button className="secondary w-full" type="button" disabled={busy} onClick={() => {
              setError("");
              setPasswordChanged(false);
              setRecovering(true);
            }}>Esqueci minha senha</button>
          </form>
        )}
        {access === "allowed" && accountId && <ClubAdmin key={accountId} accountId={accountId} />}
        {error && <p className="error" role="alert">{error}</p>}
      </div>
    </main>
  );
}
