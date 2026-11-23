import { useId, useRef, useState, type FormEvent } from "react";
import { AvatarRenderer } from "@/components/avatar/AvatarRenderer";
import type { AvatarId } from "@/lib/avatars";
import type { EquippedCosmetic } from "@/lib/store";
import { AvatarPicker } from "./AvatarPicker";

type ProfileDetails = { nome: string; avatar_skin: AvatarId };

export function ProfileEditor({ profile, cosmetics, onSave }: {
  profile: ProfileDetails;
  cosmetics?: EquippedCosmetic[];
  onSave: (details: ProfileDetails) => Promise<void>;
}) {
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const saving = useRef(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState(profile);
  const [error, setError] = useState("");

  function open() {
    setDraft(profile);
    setError("");
    dialog.current?.showModal();
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current) return;

    const nome = draft.nome.trim();
    if (nome.length < 2 || nome.length > 80) {
      setError("Informe um nome entre 2 e 80 caracteres.");
      return;
    }

    saving.current = true;
    setBusy(true);
    setError("");
    try {
      await onSave({ nome, avatar_skin: draft.avatar_skin });
      dialog.current?.close();
    } catch {
      setError("Não foi possível salvar seu perfil. Tente novamente.");
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="profile-avatar" aria-label="Editar perfil" aria-haspopup="dialog" onClick={open}>
        <AvatarRenderer skinId={profile.avatar_skin} cosmetics={cosmetics} />
      </button>
      <dialog ref={dialog} className="wallet-dialog" aria-labelledby={titleId}
        onCancel={(event) => { if (saving.current) event.preventDefault(); }}>
        <h2 id={titleId}>Editar perfil</h2>
        <form onSubmit={save} aria-busy={busy}>
          <fieldset className="space-y-4" disabled={busy}>
            <label className="field">Nome
              <input name="nome" autoComplete="name" value={draft.nome} required minLength={2} maxLength={80}
                onChange={(event) => setDraft({ ...draft, nome: event.target.value })} />
            </label>
            <AvatarPicker value={draft.avatar_skin} cosmetics={cosmetics}
              onChange={(avatar_skin) => setDraft({ ...draft, avatar_skin })} />
            {error && <p className="text-sm text-rose-300" role="alert">{error}</p>}
            <div className="grid grid-cols-2 gap-2">
              <button className="secondary" type="button" onClick={() => dialog.current?.close()}>Cancelar</button>
              <button className="primary" type="submit">{busy ? "Salvando…" : "Salvar"}</button>
            </div>
          </fieldset>
        </form>
      </dialog>
    </>
  );
}
