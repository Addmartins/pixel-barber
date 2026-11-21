"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { Gamepad2, Scissors } from "lucide-react";
import { avatars, consentVersion, type AvatarId } from "@/lib/avatars";
import { getSupabase } from "@/lib/supabase/browser";
import { normalizePhone } from "@/lib/phone";
import { AvatarSprite } from "./AvatarSprite";

type Profile = { nome: string; avatar_skin: AvatarId; level: number; points_balance: number };
const demoProfile: Profile = { nome: "Visitante", avatar_skin: "fade", level: 1, points_balance: 0 };

export function AuthScreen() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [avatar, setAvatar] = useState<AvatarId>("fade");
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<(Profile & { id: string }) | null>(null);
  const [demo, setDemo] = useState(false);
  const [pendingPhone, setPendingPhone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [profileError, setProfileError] = useState(false);
  const userId = session?.user.id;

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !userId) return;
    let active = true;

    void (async () => {
      try {
        const { data, error: failure } = await supabase.from("clients")
          .select("id,nome,avatar_skin,level,points_balance").eq("id", userId).single();
        if (!active) return;
        if (failure || !data) setProfileError(true);
        else setProfile(data);
      } catch {
        if (active) setProfileError(true);
      }
    })();

    return () => { active = false; };
  }, [userId]);

  function changeMode(nextMode: typeof mode) {
    setMode(nextMode);
    setPendingPhone(null);
    setMessage("");
    setError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError("");
    setMessage("");
    setProfileError(false);
    const supabase = getSupabase();
    if (!supabase) {
      setError("A autenticação precisa ser configurada. Você pode entrar em modo demonstração.");
      return;
    }

    const fields = new FormData(event.currentTarget);
    const phone = normalizePhone(String(fields.get("phone") ?? ""));
    if (!phone) {
      setError("Informe um celular com DDD ou use o formato internacional com + e código do país.");
      return;
    }
    const password = String(fields.get("password") ?? "");
    const nome = String(fields.get("nome") ?? "").trim();
    if (mode === "register" && (nome.length < 2 || fields.get("consent") !== "on")) {
      setError("Informe seu nome e aceite os termos e a política de privacidade.");
      return;
    }

    setBusy(true);
    try {
      if (mode === "login") {
        const { error: failure } = await supabase.auth.signInWithPassword({ phone, password });
        if (failure) {
          if (failure.code === "phone_not_confirmed") setPendingPhone(phone);
          else setError("Não foi possível entrar. Confira o celular e a senha.");
        }
      } else {
        const { data, error: failure } = await supabase.auth.signUp({
          phone,
          password,
          options: {
            channel: "sms",
            data: { nome, avatar_skin: avatar, consent_terms: true, consent_version: consentVersion },
          },
        });
        if (failure) setError("Não foi possível criar a conta. Confira os dados e tente novamente.");
        else if (!data.session) setPendingPhone(phone);
      }
    } catch {
      setError("A conexão falhou. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSms(action: "verify" | "resend", token = "") {
    const supabase = getSupabase();
    if (!supabase || !pendingPhone || busy) return;
    setError("");
    setMessage("");
    setBusy(true);

    try {
      if (action === "verify") {
        const { error: failure } = await supabase.auth.verifyOtp({ phone: pendingPhone, token, type: "sms" });
        if (failure) setError("Código inválido ou expirado. Confira o SMS ou solicite outro código.");
        else setPendingPhone(null);
      } else {
        const { error: failure } = await supabase.auth.resend({ phone: pendingPhone, type: "sms" });
        if (failure) setError("Não foi possível reenviar o código. Aguarde e tente novamente.");
        else setMessage("Código reenviado.");
      }
    } catch {
      setError("A conexão falhou. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  async function leave() {
    setMessage("");
    setError("");
    if (demo) {
      setDemo(false);
      return;
    }
    setBusy(true);
    try {
      const result = await getSupabase()?.auth.signOut({ scope: "local" });
      if (result?.error) setError("Não foi possível encerrar a sessão. Tente novamente.");
      else setProfile(null);
    } catch {
      setError("A conexão falhou. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  const currentProfile = demo ? demoProfile : profile?.id === userId ? profile : null;
  const signedIn = demo || Boolean(session);

  return (
    <main className="min-h-screen px-4 py-6 sm:px-8 sm:py-12">
      <article className="arcade mx-auto w-full max-w-lg">
        <header className="masthead">
          <div className="brand-icon"><Scissors size={27} aria-hidden="true" /></div>
          <div>
            <h1>PIXEL<span> BARBER</span></h1>
            <p>Clube da Barbearia</p>
          </div>
        </header>

        <div className="screen">
          {signedIn ? (
            <section className="space-y-5" aria-label="Perfil">
              {currentProfile ? (
                <>
                  <div className="flex items-center gap-4">
                    <div className="profile-avatar"><AvatarSprite id={currentProfile.avatar_skin} /></div>
                    <div>
                      <h2>Olá, {currentProfile.nome}!</h2>
                      <p className="muted">Nível {currentProfile.level} · {currentProfile.points_balance} pontos</p>
                    </div>
                  </div>
                  {demo && <p className="muted">Modo demonstração. Os dados desta sessão ficam no navegador.</p>}
                </>
              ) : (
                <p role="status">{profileError ? "Não foi possível carregar seu perfil. Saia e entre novamente para tentar de novo." : "Carregando seu perfil…"}</p>
              )}
              <button className="secondary w-full" onClick={() => void leave()} disabled={busy}>Sair</button>
            </section>
          ) : pendingPhone ? (
            <form className="space-y-4" onSubmit={(event) => {
              event.preventDefault();
              const token = String(new FormData(event.currentTarget).get("token") ?? "");
              void handleSms("verify", token);
            }}>
              <h2>Confirme seu celular</h2>
              <p className="muted">Informe o código do SMS para o celular com final {pendingPhone.slice(-4)}. Se precisar, solicite um novo código.</p>
              <label className="field">
                Código do SMS
                <input name="token" type="text" inputMode="numeric" autoComplete="one-time-code"
                  pattern="[0-9]{6}" maxLength={6} required />
              </label>
              <button className="primary w-full" disabled={busy}>Confirmar código</button>
              <button className="secondary w-full" type="button" disabled={busy} onClick={() => void handleSms("resend")}>
                Reenviar código
              </button>
              <button className="secondary w-full" type="button" disabled={busy} onClick={() => changeMode(mode)}>
                Voltar
              </button>
            </form>
          ) : (
            <>
              <div className="mode-switch" role="group" aria-label="Acesso ao clube">
                <button type="button" aria-pressed={mode === "login"} onClick={() => changeMode("login")} disabled={busy}>Entrar</button>
                <button type="button" aria-pressed={mode === "register"} onClick={() => changeMode("register")} disabled={busy}>Criar conta</button>
              </div>

              <form key={mode} onSubmit={submit} className="mt-6 space-y-4">
                <h2>{mode === "register" ? "Crie seu perfil" : "Entre no clube"}</h2>
                {mode === "register" && (
                  <label className="field">Nome <input name="nome" autoComplete="name" required minLength={2} maxLength={80} /></label>
                )}
                <label className="field">
                  Celular
                  <input name="phone" type="tel" inputMode="tel" autoComplete={mode === "login" ? "username" : "tel"}
                    placeholder="(81) 99999-9999" maxLength={30} required />
                  <span className="muted text-sm">Use o DDD ou informe o número com código do país.</span>
                </label>
                <label className="field">
                  Senha
                  <input name="password" type="password" required minLength={mode === "register" ? 8 : undefined}
                    autoComplete={mode === "register" ? "new-password" : "current-password"} />
                  {mode === "register" && <span className="muted text-sm">Use pelo menos 8 caracteres.</span>}
                </label>

                {mode === "register" && (
                  <>
                    <fieldset>
                      <legend className="mb-2 font-semibold">Escolha seu avatar</legend>
                      <div className="grid grid-cols-2 gap-2 min-[390px]:grid-cols-4">
                        {avatars.map((option) => (
                          <label key={option.id} className="avatar-option">
                            <input className="sr-only" type="radio" name="avatar" value={option.id}
                              checked={avatar === option.id} onChange={() => setAvatar(option.id)} />
                            <span className="avatar-card">
                              <AvatarSprite id={option.id} />
                              <span>{option.name}</span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </fieldset>

                    <details className="terms">
                      <summary>Termos e política de privacidade</summary>
                      <p>Esta versão de testes usa seu nome, celular e avatar para criar sua conta e exibir seu perfil. O Supabase processa as credenciais de acesso. Quando a confirmação por SMS está habilitada, o provedor de SMS recebe o número para enviar o código. A data e a versão do aceite ficam registradas no perfil.</p>
                      <p>Use a conta somente para testar o Pixel Barber. Para pedir acesso, correção ou exclusão de dados, procure o responsável que disponibilizou este ambiente de testes.</p>
                    </details>
                    <label className="flex items-start gap-3 text-sm">
                      <input className="mt-0.5 size-5 shrink-0 accent-pink-400" name="consent" type="checkbox" required />
                      <span>Li e aceito os Termos de Uso e a Política de Privacidade desta versão de testes.</span>
                    </label>
                  </>
                )}
                <button className="primary w-full" disabled={busy}>
                  {busy ? "Aguarde…" : mode === "register" ? "Criar minha conta" : "Entrar"}
                </button>
              </form>

              <button className="secondary mt-3 flex w-full items-center justify-center gap-2" disabled={busy} onClick={() => {
                setError("");
                setMessage("");
                setDemo(true);
              }}>
                <Gamepad2 size={20} aria-hidden="true" /> Experimentar demonstração
              </button>
            </>
          )}
          {error && <p className="feedback error" role="alert">{error}</p>}
          {message && <p className="feedback" role="status">{message}</p>}
        </div>
      </article>
    </main>
  );
}
