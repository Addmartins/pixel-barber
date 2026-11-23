"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { Gamepad2, Scissors } from "lucide-react";
import { consentVersion, type AvatarId } from "@/lib/avatars";
import { getSupabase } from "@/lib/supabase/browser";
import { normalizePhone } from "@/lib/phone";
import type { EquippedCosmetic } from "@/lib/store";
import { AvatarPicker } from "./AvatarPicker";
import { ProfileEditor } from "./ProfileEditor";
import { PasswordReset } from "./PasswordReset";
import { WalletDialogs } from "./WalletDialogs";
import { Dashboard } from "@/components/dashboard/Dashboard";

type Profile = { nome: string; avatar_skin: AvatarId; level: number; points_balance: number };
const termsPath = process.env.NEXT_PUBLIC_BACKEND_ORIGIN
  ? new URL("/termos", process.env.NEXT_PUBLIC_BACKEND_ORIGIN).href
  : "/termos";

const demoProfile: Profile = { nome: "Visitante", avatar_skin: "fade", level: 1, points_balance: 1000 };

function signupError(code: string | undefined) {
  switch (code) {
    case "phone_provider_disabled":
    case "signup_disabled":
      return "O cadastro por celular está desativado no momento. Você ainda pode experimentar a demonstração.";
    case "sms_send_failed":
      return "O serviço de SMS não conseguiu enviar o código. Tente novamente mais tarde.";
    case "over_sms_send_rate_limit":
    case "over_request_rate_limit":
      return "Muitas tentativas em pouco tempo. Aguarde alguns minutos antes de tentar novamente.";
    case "weak_password":
      return "A senha não atende aos requisitos de segurança. Use uma senha mais longa e variada.";
    case "phone_exists":
    case "user_already_exists":
      return "Não foi possível criar a conta. Se você já tem cadastro, entre com seu celular e senha.";
    case "validation_failed":
      return "Confira se o número do celular e os demais campos estão corretos.";
    default:
      return "Não foi possível criar a conta agora. Tente novamente mais tarde.";
  }
}

export function AuthScreen() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [avatar, setAvatar] = useState<AvatarId>("fade");
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<(Profile & { id: string }) | null>(null);
  const [demoEntry, setDemoEntry] = useState<"booking" | "arcade" | null>(null);
  const demo = demoEntry !== null;
  const [demoDetails, setDemoDetails] = useState<Pick<Profile, "nome" | "avatar_skin">>(demoProfile);
  const [demoBalance, setDemoBalance] = useState(demoProfile.points_balance);
  const [equipped, setEquipped] = useState<{ owner: string; cosmetics: EquippedCosmetic[] } | null>(null);
  const [recovery, setRecovery] = useState<{ phone: string }>();
  const [pendingPhone, setPendingPhone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [profileError, setProfileError] = useState(false);
  const userId = session?.user.id;
  const userPhone = session?.user.phone;
  const cosmeticsOwner = demo ? "demo" : userId;
  const updateCosmetics = useCallback((cosmetics: EquippedCosmetic[]) => {
    if (cosmeticsOwner) setEquipped({ owner: cosmeticsOwner, cosmetics });
  }, [cosmeticsOwner]);
  const updatePointsBalance = useCallback((points_balance: number) => {
    if (demo) return setDemoBalance(points_balance);
    setProfile((current) => current && current.id === userId ? { ...current, points_balance } : current);
  }, [demo, userId]);

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
        await supabase.rpc("get_current_points_balance");
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

  useEffect(() => {
    if (!userId) return;
    let active = true;
    let pending = false;
    async function refresh() {
      if (document.hidden || pending) return;
      pending = true;
      try {
        const result = await getSupabase()?.rpc("get_current_points_balance");
        if (active && result && !result.error) {
          setProfile((current) => current && current.id === userId ? { ...current, points_balance: result.data } : current);
        }
      } catch { /* The next refresh can retry. */ }
      finally { pending = false; }
    }
    const timer = window.setInterval(refresh, 60_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [userId]);

  function startRecovery(phone = "") {
    setError("");
    setMessage("");
    setRecovery({ phone });
  }

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
      setError("Informe seu nome e aceite os Termos de Uso da Aplicação.");
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
            data: {
              nome, avatar_skin: avatar, consent_terms: true,
              // Older database triggers still expect the original signup protocol version.
              consent_version: "2026-11-21-phone-preview", app_terms_version: consentVersion,
            },
          },
        });
        if (failure) setError(signupError(failure.code));
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
      setDemoEntry(null);
      setDemoDetails(demoProfile);
      setDemoBalance(demoProfile.points_balance);
      setEquipped(null);
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

  async function saveProfile(details: Pick<Profile, "nome" | "avatar_skin">) {
    if (demo) {
      setDemoDetails(details);
      return;
    }

    const supabase = getSupabase();
    if (!supabase || !userId) throw new Error("Sessão indisponível.");
    const { data, error } = await supabase.from("clients")
      .update(details).eq("id", userId).select("nome,avatar_skin").single();
    if (error || !data) throw new Error("Perfil indisponível.");
    setProfile((current) => current?.id === userId ? { ...current, ...data } : current);
  }

  const currentProfile = demo ? { ...demoProfile, ...demoDetails, points_balance: demoBalance } : profile?.id === userId ? profile : null;
  const signedIn = !recovery && (demo || Boolean(session));

  return (
    <main className={signedIn && currentProfile ? "device-shell has-bottom-nav" : "device-shell"}>
      <div className="shell-content">
        <header className="masthead">
          <div className="masthead-brand">
            <div className="brand-icon"><Scissors size={20} aria-hidden="true" /></div>
            <div>
              <h1>PIXEL<span> BARBER</span></h1>
              <p>Clube de Fidelidade</p>
            </div>
            {signedIn && currentProfile && (
              <WalletDialogs key={demo ? "demo" : userId} userId={demo ? undefined : userId} balance={currentProfile.points_balance} />
            )}
          </div>
          {signedIn && currentProfile && (
            <div className="masthead-account">
              <ProfileEditor key={cosmeticsOwner} profile={currentProfile} onSave={saveProfile}
                onChangePassword={userPhone && !demo ? () => startRecovery("+" + userPhone.replace(/^\+/, "")) : undefined}
                cosmetics={equipped?.owner === cosmeticsOwner ? equipped?.cosmetics : undefined} />
              <div className="masthead-profile">
                <h2>Olá, {currentProfile.nome}!</h2>
                <p>Nível {currentProfile.level}</p>
              </div>
              <button type="button" className="masthead-signout" onClick={() => void leave()} disabled={busy}>Sair</button>
            </div>
          )}
        </header>

        <div className={signedIn ? "min-w-0" : "card-modern auth-card"}>
          {recovery ? <PasswordReset initialPhone={recovery.phone} onCancel={() => setRecovery(undefined)}
            onSuccess={() => { setRecovery(undefined); setMessage("Senha alterada."); }} />
            : signedIn ? (
            <section className="space-y-4" aria-label="Painel do cliente">
              {currentProfile ? (
                <>
                  {demo && <p className="muted text-sm">Demonstração com dados de exemplo. As reservas duram até você sair ou atualizar a página.</p>}
                  <Dashboard key={demo ? "demo" : userId} initialSection={demoEntry ?? undefined} clientId={demo ? undefined : userId} name={currentProfile.nome} avatar={currentProfile.avatar_skin} balance={currentProfile.points_balance}
                    onPointsBalance={updatePointsBalance} onCosmetics={updateCosmetics} />
                </>
              ) : (
                <>
                  <p role="status">{profileError ? "Não foi possível carregar seu perfil. Saia e entre novamente para tentar de novo." : "Carregando seu perfil…"}</p>
                  <button type="button" className="secondary w-full" onClick={() => void leave()} disabled={busy}>Sair</button>
                </>
              )}
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
                    <AvatarPicker value={avatar} onChange={setAvatar} />

                    <label className="flex items-start gap-3 text-sm">
                      <input className="mt-0.5 size-5 shrink-0 accent-teal-400" name="consent" type="checkbox" required />
                      <span>Li e aceito os <a className="underline" href={termsPath} target="_blank" rel="noopener">Termos de Uso da Aplicação</a>.</span>
                    </label>
                  </>
                )}
                <button className="primary w-full" disabled={busy}>
                  {busy ? "Aguarde…" : mode === "register" ? "Criar minha conta" : "Entrar"}
                </button>
              </form>

              {mode === "login" && <button type="button" className="secondary mt-3 w-full" disabled={busy}
                onClick={() => startRecovery()}>Esqueci minha senha</button>}
              <button className="secondary mt-3 flex w-full items-center justify-center gap-2" disabled={busy} onClick={() => {
                setError("");
                setMessage("");
                setDemoEntry("booking");
              }}>
                Experimentar demonstração
              </button>
              <button type="button" className="secondary mt-2 flex w-full items-center justify-center gap-2" disabled={busy}
                onClick={() => {
                  setError("");
                  setMessage("");
                  setDemoEntry("arcade");
                }}>
                <Gamepad2 size={20} aria-hidden="true" /> Jogar Pixel Boy sem conta
              </button>
              <a href={process.env.NEXT_PUBLIC_BACKEND_ORIGIN ? "/admin.html" : "/admin"}
                className="muted mt-4 block text-center text-sm underline">Acesso administrativo</a>
            </>
          )}
          {error && <p className="feedback error" role="alert">{error}</p>}
          {message && <p className="feedback" role="status">{message}</p>}
        </div>
        <footer className="text-center text-sm">
          <a className="muted underline" href={termsPath}>Termos de Uso da Aplicação</a>
          <nav className="muted mt-2" aria-label="Contato do desenvolvedor">
            <p>Contato do desenvolvedor</p>
            <ul className="mt-1 flex flex-wrap justify-center gap-x-4 gap-y-1">
              <li><a className="underline" href="https://www.linkedin.com/in/addhyel-martins/" target="_blank" rel="noopener noreferrer">LinkedIn</a></li>
              <li><a className="underline" href="https://github.com/Addmartins" target="_blank" rel="noopener noreferrer">GitHub</a></li>
              <li><a className="underline" href="mailto:addhyeldev@gmail.com">addhyeldev@gmail.com</a></li>
            </ul>
          </nav>
        </footer>
      </div>
    </main>
  );
}
