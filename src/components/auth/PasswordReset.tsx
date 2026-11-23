import { useRef, useState, type FormEvent } from "react";
import { normalizePhone } from "@/lib/phone";
import { createRecoveryClient } from "@/lib/supabase/browser";

export function PasswordReset({ initialPhone, onCancel, onSuccess }: {
  initialPhone: string;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const [phone, setPhone] = useState("");
  const recoveryClient = useRef<ReturnType<typeof createRecoveryClient>>(null);
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function send(number: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const db = recoveryClient.current ??= createRecoveryClient();
      if (!db) throw new Error();
      const result = await db.auth.signInWithOtp({ phone: number, options: { channel: "sms", shouldCreateUser: false } });
      if (result.error && !["otp_disabled", "user_not_found", "signup_disabled"].includes(result.error.code ?? "")) {
        setError("Não foi possível solicitar o SMS. Aguarde e tente novamente.");
        return;
      }
      setPhone(number);
      setMessage("Se o celular estiver cadastrado, você receberá um código por SMS.");
    } catch { setError("A conexão falhou. Tente novamente."); }
    finally { setBusy(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const fields = new FormData(event.currentTarget);
    if (!phone) {
      const number = normalizePhone(String(fields.get("phone") ?? ""));
      if (!number) setError("Informe um celular válido com DDD.");
      else await send(number);
      return;
    }

    const password = String(fields.get("password") ?? "");
    if (password.length < 8 || password !== fields.get("confirmation")) {
      setError("Use pelo menos 8 caracteres e confirme a mesma senha.");
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");
    try {
      const db = recoveryClient.current ??= createRecoveryClient();
      if (!db) throw new Error();
      if (!verified) {
        const token = String(fields.get("token") ?? "");
        const result = await db.auth.verifyOtp({ phone, token, type: "sms" });
        if (result.error || !result.data.session) {
          setError("Código inválido ou expirado. Confira o SMS ou peça outro código.");
          return;
        }
        setVerified(true);
      }
      const result = await db.auth.updateUser({ password });
      if (result.error) {
        if (result.error.code === "session_not_found" || result.error.code === "session_expired") {
          setVerified(false);
          setError("A sessão de verificação expirou. Solicite um novo código.");
          return;
        }
        setError(result.error.code === "same_password" ? "Escolha uma senha diferente da atual."
          : result.error.code === "weak_password" ? "Use uma senha mais forte e tente novamente."
          : "Não foi possível alterar a senha. Tente novamente.");
        return;
      }
      onSuccess();
    } catch { setError("A conexão falhou. Tente novamente."); }
    finally { setBusy(false); }
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <h2>Alterar senha por SMS</h2>
      {!phone ? (
        <label className="field">Celular <input name="phone" type="tel" autoComplete="tel" maxLength={30}
          defaultValue={initialPhone} readOnly={Boolean(initialPhone)} required /></label>
      ) : (
        <>
          {!verified && <label className="field">Código do SMS
            <input name="token" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required />
          </label>}
          <label className="field">Nova senha
            <input name="password" type="password" autoComplete="new-password" minLength={8} required />
          </label>
          <label className="field">Confirme a nova senha
            <input name="confirmation" type="password" autoComplete="new-password" minLength={8} required />
          </label>
        </>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      {message && <p className="muted" role="status">{message}</p>}
      <button className="primary w-full" disabled={busy}>{busy ? "Aguarde…" : phone ? "Salvar nova senha" : "Enviar código"}</button>
      {phone && !verified && <button className="secondary w-full" type="button" disabled={busy}
        onClick={() => void send(phone)}>Reenviar código</button>}
      <button className="secondary w-full" type="button" disabled={busy} onClick={onCancel}>Voltar</button>
    </form>
  );
}
