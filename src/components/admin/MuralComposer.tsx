import { useState, type FormEvent } from "react";
import { AvatarRenderer } from "@/components/avatar/AvatarRenderer";
import { muralBucket, muralPhotoBytes, muralPhotoFormats, muralPhotoLimit, type MuralTag } from "@/lib/club";
import { getSupabase } from "@/lib/supabase/browser";

export function MuralComposer({ accountId, disabled, onBusy, onPublished }: {
  accountId: string;
  disabled: boolean;
  onBusy: (busy: boolean) => void;
  onPublished: () => void;
}) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<MuralTag[]>();
  const [tag, setTag] = useState<MuralTag>();
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [error, setError] = useState("");
  const [publishing, setPublishing] = useState(false);

  async function search() {
    const name = query.trim();
    if (name.length < 2 || searching) return;
    setSearching(true);
    setSearchError(false);
    setOptions(undefined);
    try {
      const result = await getSupabase()?.rpc("find_mural_clients", { p_query: name });
      if (!result || result.error) throw new Error();
      setOptions(result.data);
    } catch { setSearchError(true); }
    finally { setSearching(false); }
  }

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;
    const db = getSupabase();
    if (!db) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const title = String(fields.get("title") ?? "").trim();
    const caption = String(fields.get("caption") ?? "").trim();
    const files = fields.getAll("photos").filter((value): value is File => value instanceof File && value.size > 0);
    if (!title || (!caption && !files.length)) {
      setError("Preencha o título e adicione uma foto ou legenda.");
      return;
    }
    if (files.length > muralPhotoLimit || files.some((file) => !muralPhotoFormats[file.type] || file.size > muralPhotoBytes)) {
      setError("Escolha até 4 fotos JPG, PNG ou WebP, com até 6 MB cada.");
      return;
    }
    const storage = db.storage.from(muralBucket);
    const paths: string[] = [];
    setError("");
    setPublishing(true);
    onBusy(true);
    try {
      for (const file of files) {
        const path = `${accountId}/${crypto.randomUUID()}.${muralPhotoFormats[file.type]}`;
        paths.push(path);
        const upload = await storage.upload(path, file, { contentType: file.type });
        if (upload.error) throw upload.error;
      }
      const result = await db.rpc("publish_mural_notice", {
        p_title: title, p_caption: caption, p_photos: paths, p_tagged_client: tag?.id,
      });
      if (result.error) throw result.error;
      form.reset();
      setTag(undefined);
      setQuery("");
      setOptions(undefined);
      onPublished();
    } catch {
      if (paths.length) await storage.remove(paths).catch(() => undefined);
      setError("Não foi possível publicar. Confira o mural antes de tentar novamente.");
    } finally {
      onBusy(false);
      setPublishing(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={(event) => void publish(event)}>
      <fieldset className="space-y-3" disabled={disabled}>
        <label className="field">Título <input name="title" maxLength={100} required /></label>
        <label className="field">Fotos <input name="photos" type="file" accept={Object.keys(muralPhotoFormats).join(",")} multiple /></label>
        <p className="muted text-sm">Até 4 fotos JPG, PNG ou WebP, de até 6 MB cada.</p>
        <label className="field">Legenda <textarea name="caption" maxLength={1000} rows={3} /></label>
        <div className="space-y-2">
          {tag ? <div className="flex flex-wrap items-center gap-2">
            <AvatarRenderer skinId={tag.avatar_skin} size={32} /><span>{tag.nome}</span>
            <button type="button" className="secondary" onClick={() => { setTag(undefined); setQuery(""); }}>Remover marcação</button>
          </div> : <>
            <label className="field">Marcar avatar de um cliente
              <input type="search" value={query} maxLength={80} placeholder="Busque pelo nome"
                onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void search(); } }}
                onChange={(event) => { setQuery(event.target.value); setOptions(undefined); }} />
            </label>
            <button type="button" className="secondary" disabled={searching || query.trim().length < 2}
              onClick={() => void search()}>{searching ? "Buscando…" : "Buscar cliente"}</button>
            {searchError && <p className="error" role="alert">Não foi possível buscar clientes.</p>}
            {options && !options.length && <p className="muted" role="status">Nenhum cliente encontrado.</p>}
            {options && <ul className="space-y-1">{options.map((option) => (
              <li key={option.id}>
                <button type="button" className="secondary flex w-full items-center gap-2" onClick={() => setTag(option)}>
                  <AvatarRenderer skinId={option.avatar_skin} size={28} /> {option.nome}
                </button>
              </li>
            ))}</ul>}
          </>}
        </div>
        <button type="submit" className="primary">{publishing ? "Publicando…" : "Publicar no mural"}</button>
      </fieldset>
      {error && <p className="error" role="alert">{error}</p>}
    </form>
  );
}
