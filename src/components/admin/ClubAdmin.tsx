import { useEffect, useState, type FormEvent } from "react";
import { brasiliaDate } from "@/lib/booking";
import type { Barber } from "@/lib/booking";
import { attendanceLabel, clubDateTime, muralBucket, muralPhotoBytes, muralPhotoFormats, type ClubAppointment, type ClubMetrics, type ClubNotice, type ClubSuggestion } from "@/lib/club";
import { getSupabase } from "@/lib/supabase/browser";
import { NoticePost } from "@/components/dashboard/NoticePost";
import { CutMuralTitle } from "@/components/CutMuralTitle";
import { BarberAddress } from "@/components/BarberAddress";
import { MuralComposer } from "./MuralComposer";

const sections = { agenda: "Agenda", notices: "Publicações", barbers: "Barbeiros", suggestions: "Sugestões" } as const;
type Section = keyof typeof sections;
const barberPhotosBucket = "barber-photos";

function BarberPhotoInput({ disabled }: { disabled: boolean }) {
  return <label className="field">Enviar foto (JPG, PNG ou WebP, até 6 MB)
    <input type="file" name="photoFile" accept={Object.keys(muralPhotoFormats).join(",")} disabled={disabled} />
  </label>;
}

export function ClubAdmin({ accountId }: { accountId: string }) {
  const [section, setSection] = useState<Section>("agenda");
  const [day, setDay] = useState(() => brasiliaDate(Date.now()));
  const [metrics, setMetrics] = useState<ClubMetrics>();
  const [appointments, setAppointments] = useState<ClubAppointment[]>([]);
  const [portfolio, setPortfolio] = useState(false);
  const [postPage, setPostPage] = useState(0);
  const [hasMorePosts, setHasMorePosts] = useState(false);
  const [notices, setNotices] = useState<ClubNotice[]>([]);
  const [suggestions, setSuggestions] = useState<ClubSuggestion[]>([]);
  const [supportsAlbumBarbers, setSupportsAlbumBarbers] = useState(false);
  const [albumBarbers, setAlbumBarbers] = useState<Record<string, string | null>>({});
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [reviewed, setReviewed] = useState(false);
  const [suggestionPage, setSuggestionPage] = useState(0);
  const [hasMoreSuggestions, setHasMoreSuggestions] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const [publicationStatus, setPublicationStatus] = useState("");
  const [loadError, setLoadError] = useState("");
  const db = getSupabase();

  useEffect(() => {
    if (!db) return;
    let active = true;
    const client = db;
    async function load() {
      setLoading(true);
      setLoadError("");
      try {
        const metricsResult = await client.rpc("get_club_metrics");
        if (!active) return;
        if (metricsResult.error) throw metricsResult.error;
        setMetrics(metricsResult.data[0]);

        switch (section) {
          case "agenda": {
            const result = await client.rpc("get_club_appointments", { p_day: day });
            if (result.error) throw result.error;
            if (active) setAppointments(result.data);
            break;
          }
          case "notices": {
            const result = await client.rpc("get_club_posts", {
              p_portfolio: portfolio, p_limit: portfolio ? 9 : 2, p_offset: portfolio ? postPage * 8 : 0,
            });
            if (result.error) throw result.error;
            if (portfolio) {
              const ids = result.data.slice(0, 8).map(({ id }) => id);
              const [catalog, assignments] = await Promise.all([
                client.from("barbers").select("*").order("nome"),
                ids.length ? client.from("club_notices").select("id,barber_id").in("id", ids)
                  : client.from("club_notices").select("id,barber_id").limit(0),
              ]);
              const assignmentError = assignments.error?.code;
              if (catalog.error || (assignments.error && assignmentError !== "42703" && assignmentError !== "42501")) {
                throw catalog.error ?? assignments.error;
              }
              if (active) {
                setBarbers(catalog.data);
                setSupportsAlbumBarbers(assignmentError !== "42703");
                setAlbumBarbers(Object.fromEntries((assignments.data ?? []).map(({ id, barber_id }) => [id, barber_id])));
              }
            }
            if (active) {
              setNotices(result.data.slice(0, portfolio ? 8 : 2));
              setHasMorePosts(portfolio && result.data.length > 8);
            }
            break;
          }
          case "barbers": {
            const result = await client.from("barbers").select("*").order("nome");
            if (result.error) throw result.error;
            if (active) setBarbers(result.data);
            break;
          }
          case "suggestions": {
            const query = client.from("club_suggestions").select("*");
            const offset = suggestionPage * 20;
            const result = await (reviewed ? query.not("reviewed_at", "is", null) : query.is("reviewed_at", null))
              .order("created_at", { ascending: false }).order("id", { ascending: false }).range(offset, offset + 20);
            if (result.error) throw result.error;
            if (active) {
              setSuggestions(result.data.slice(0, 20));
              setHasMoreSuggestions(result.data.length > 20);
            }
            break;
          }
        }
      } catch {
        if (active) setLoadError("Não foi possível carregar os dados.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [db, day, portfolio, postPage, reviewed, revision, section, suggestionPage]);

  async function mutate(action: () => PromiseLike<{ error: { code?: string; message: string } | null }>, form?: HTMLFormElement) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await action();
      if (result.error) {
        setError(result.error.code === "PT409" ? result.error.message : "Não foi possível concluir a ação. Tente novamente.");
        return;
      }
      form?.reset();
      setRevision((current) => current + 1);
    } catch { setError("A conexão falhou. Tente novamente."); }
    finally { setBusy(false); }
  }

  function saveBarberPhoto(
    fields: FormData,
    save: (uploadedPhoto?: string) => PromiseLike<{ error: { code?: string; message: string } | null }>,
    form: HTMLFormElement,
  ) {
    if (!db) return;
    const file = fields.get("photoFile");
    if (!(file instanceof File) || file.size === 0) {
      void mutate(() => save(), form);
      return;
    }
    const extension = muralPhotoFormats[file.type];
    if (!extension || file.size > muralPhotoBytes) {
      setError("Escolha uma foto JPG, PNG ou WebP de até 6 MB.");
      return;
    }

    void mutate(async () => {
      const storage = db.storage.from(barberPhotosBucket);
      const path = `${crypto.randomUUID()}.${extension}`;
      const upload = await storage.upload(path, file, { contentType: file.type });
      if (upload.error) {
        return { error: { code: "PT409", message: "Não foi possível enviar a foto. Tente novamente." } };
      }
      const result = await save(storage.getPublicUrl(path).data.publicUrl);
      if (result.error) await storage.remove([path]).catch(() => undefined);
      return result;
    }, form);
  }

  async function removeBarberPhoto(url: string | null) {
    if (!db || !url) return;
    const storage = db.storage.from(barberPhotosBucket);
    const path = url.split("/").pop() ?? "";
    if (/^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(path) && storage.getPublicUrl(path).data.publicUrl === url) {
      await storage.remove([path]).catch(() => undefined);
    }
  }

  function submitBarber(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!db) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const name = String(fields.get("name") ?? "").trim();
    const detail = String(fields.get("detail") ?? "").trim();
    const address = String(fields.get("address") ?? "").trim() || null;
    if (!name || !detail) {
      setError("Preencha o nome e a especialidade.");
      return;
    }
    saveBarberPhoto(fields, (uploadedPhoto) => db.from("barbers").insert({
      nome: name,
      especialidade: detail,
      ...(address ? { endereco: address } : {}),
      ...(uploadedPhoto ? { foto_pixel: uploadedPhoto } : {}),
    }), form);
  }

  function saveBarberDetails(event: FormEvent<HTMLFormElement>, barber: Barber) {
    event.preventDefault();
    if (!db) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const address = String(fields.get("address") ?? "").trim() || null;
    const photo = String(fields.get("photo") ?? "").trim() || null;
    if (photo && photo !== barber.foto_pixel && !/^https:\/\//i.test(photo)) {
      setError("Use um link HTTPS para a foto.");
      return;
    }
    saveBarberPhoto(fields, async (uploadedPhoto) => {
      const nextPhoto = uploadedPhoto ?? photo;
      const updates = nextPhoto === barber.foto_pixel ? { endereco: address } : { endereco: address, foto_pixel: nextPhoto };
      const result = await db.from("barbers").update(updates).eq("id", barber.id).select("id").single();
      if (!result.error && nextPhoto !== barber.foto_pixel) await removeBarberPhoto(barber.foto_pixel);
      return result;
    }, form);
  }

  function deleteBarber(barber: Barber) {
    if (!db || busy || !window.confirm(`Excluir o cadastro de ${barber.nome}?`)) return;
    void mutate(async () => {
      const result = await db.from("barbers").delete().eq("id", barber.id).select("foto_pixel").single();
      if (result.error?.code === "23503") {
        return { error: { code: "PT409", message: "Este barbeiro tem agendamentos vinculados e não pode ser excluído." } };
      }
      if (!result.error) await removeBarberPhoto(result.data.foto_pixel);
      return result;
    });
  }

  function deletePublication(notice: ClubNotice) {
    const label = portfolio ? "álbum" : "aviso";
    if (!db || busy || !window.confirm(`Excluir este ${label}?`)) return;
    setPublicationStatus("");
    void mutate(async () => {
      const result = await db.from("club_notices").delete().eq("id", notice.id).select("photo_paths").single();
      if (result.error) return result;

      const paths = result.data.photo_paths;
      let status = "Publicação excluída.";
      if (paths.length > 0) {
        const cleaned = await db.storage.from(muralBucket).remove(paths)
          .then(({ data, error }) => !error && data.length === paths.length)
          .catch(() => false);
        if (!cleaned) status += " A limpeza dos arquivos de imagem ficou incompleta.";
      }
      setPublicationStatus(status);
      if (postPage > 0 && notices.length === 1 && !hasMorePosts) setPostPage((current) => current - 1);
      return result;
    });
  }

  if (!db) return null;
  return (
    <div className="space-y-4">
      {metrics && <section className="card-modern space-y-3" aria-label="Métricas da semana">
        <h2>Métricas da semana</h2>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {([
            ["Agendados", metrics.scheduled], ["Concluídos", metrics.completed],
            ["Cancelados", metrics.cancelled], ["Faltas", metrics.missed],
            ["Sugestões pendentes", metrics.pending_suggestions],
          ] as const).map(([label, count]) => (
            <div key={label}><dt className="muted text-sm">{label}</dt><dd className="text-xl font-bold">{count}</dd></div>
          ))}
        </dl>
      </section>}

      <nav className="mode-switch grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Administração">
        {(Object.keys(sections) as Section[]).map((key) => (
          <button type="button" key={key} aria-pressed={section === key} disabled={busy}
            onClick={() => { setSection(key); setError(""); setPublicationStatus(""); }}>{sections[key]}</button>
        ))}
      </nav>

      {loading && <p role="status">Carregando…</p>}
      {loadError && <div className="space-y-2"><p className="error" role="alert">{loadError}</p>
        <button type="button" className="secondary" onClick={() => setRevision(revision + 1)}>Tentar novamente</button>
      </div>}
      {error && <p className="error" role="alert">{error}</p>}

      {section === "agenda" && <section className="card-modern space-y-3">
        <h2>Agendamentos</h2>
        <label className="field">Data <input type="date" value={day} disabled={busy}
          onChange={(event) => { if (event.target.value) setDay(event.target.value); }} /></label>
        {!loading && !loadError && (appointments.length ? <ul className="space-y-3">
          {appointments.map((item) => (
            <li key={item.id} className="border-t border-white/10 pt-3">
              <strong>{item.client_name}</strong>
              <p>{clubDateTime.format(new Date(item.starts_at))} · {item.service_name} · {item.barber_name}</p>
              <p className="muted">{attendanceLabel[item.status]}</p>
              {item.status === "AGENDADO" && Date.parse(item.ends_at) <= Date.now() && <div className="mt-2 flex flex-wrap gap-2">
                {(["CONCLUIDO", "NO_SHOW"] as const).map((status) => (
                  <button type="button" className="secondary" key={status} disabled={busy}
                    onClick={() => {
                      if (status === "NO_SHOW" && !window.confirm("Registrar falta e aplicar a regra de pontos?")) return;
                      void mutate(async () => {
                        const result = await db.rpc("set_club_attendance", { p_id: item.id, p_status: status });
                        return { error: result.error ?? (result.data ? null : { code: "PT409", message: "Este agendamento já foi atualizado ou ainda não terminou." }) };
                      });
                    }}>{status === "CONCLUIDO" ? "Registrar presença" : "Registrar falta"}</button>
                ))}
              </div>}
            </li>
          ))}
        </ul> : <p className="muted">Nenhum agendamento nesta data.</p>)}
      </section>}

      {section === "notices" && <section className="card-modern space-y-4">
        <h2>{portfolio ? <CutMuralTitle /> : "Quadro de avisos"}</h2>
        {publicationStatus && <p role="status">{publicationStatus}</p>}
        <div className="mode-switch grid grid-cols-2 gap-2" aria-label="Tipo de publicação">
          <button type="button" aria-pressed={!portfolio} disabled={busy} onClick={() => { setPortfolio(false); setPostPage(0); setPublicationStatus(""); }}>Avisos</button>
          <button type="button" aria-pressed={portfolio} disabled={busy} onClick={() => { setPortfolio(true); setPostPage(0); setPublicationStatus(""); }}>Álbuns</button>
        </div>
        {!portfolio && !loading && !loadError && notices.length >= 2
          ? <p className="muted">O quadro já tem dois avisos. Remova um para publicar outro.</p>
          : <MuralComposer key={String(portfolio)} accountId={accountId} portfolio={portfolio} linkBarber={supportsAlbumBarbers} barbers={barbers} disabled={busy || (portfolio && (loading || Boolean(loadError)))}
            onBusy={setBusy} onPublished={() => { setPostPage(0); setRevision((current) => current + 1); }} />}
        {!loading && !loadError && notices.map((notice) => (
          <article key={notice.id} className="space-y-2 border-t border-white/10 pt-3">
            <NoticePost notice={notice} />
            {portfolio && albumBarbers[notice.id] !== undefined && <form className="space-y-2" onSubmit={(event) => {
              event.preventDefault();
              const barberId = String(new FormData(event.currentTarget).get("albumBarber") ?? "") || null;
              void mutate(() => db.from("club_notices").update({ barber_id: barberId }).eq("id", notice.id).select("id").single());
            }}>
              <label className="field">Barbeiro do álbum
                <select name="albumBarber" defaultValue={albumBarbers[notice.id] ?? ""} disabled={busy}>
                  <option value="">Sem barbeiro vinculado</option>
                  {barbers.map((barber) => <option key={barber.id} value={barber.id}>{barber.nome}</option>)}
                </select>
              </label>
              <button type="submit" className="secondary" disabled={busy}>Salvar barbeiro do álbum</button>
            </form>}
            <button type="button" className="secondary" disabled={busy} onClick={() => deletePublication(notice)}>
              Excluir {portfolio ? "álbum" : "aviso"}
            </button>
          </article>
        ))}
        {portfolio && !loading && !loadError && (postPage > 0 || hasMorePosts) && <div className="flex gap-2">
          {postPage > 0 && <button type="button" className="secondary" disabled={busy} onClick={() => setPostPage(postPage - 1)}>Anterior</button>}
          {hasMorePosts && <button type="button" className="secondary" disabled={busy} onClick={() => setPostPage(postPage + 1)}>Próxima</button>}
        </div>}
      </section>}

      {section === "barbers" && <section className="card-modern space-y-4">
        <h2>Barbeiros</h2>
        <form className="space-y-3" onSubmit={submitBarber}>
          <label className="field">Nome <input name="name" maxLength={80} required /></label>
          <label className="field">Especialidade <input name="detail" maxLength={100} required /></label>
          {(barbers.length === 0 || barbers[0].endereco !== undefined) &&
            <label className="field">Endereço de atendimento (opcional) <input name="address" maxLength={240} /></label>}
          <BarberPhotoInput disabled={busy} />
          <button className="primary" disabled={busy}>Adicionar barbeiro</button>
        </form>
        {!loading && !loadError && <ul className="space-y-2">{barbers.map((barber) => (
          <li key={barber.id} className="space-y-2 border-t border-white/10 pt-3">
            <p>{barber.nome} <span className="muted">· {barber.especialidade}</span></p>
            {barber.endereco && <BarberAddress address={barber.endereco} />}
            {barber.endereco !== undefined && <form key={JSON.stringify([barber.endereco, barber.foto_pixel])}
              className="space-y-2" onSubmit={(event) => saveBarberDetails(event, barber)}>
              <label className="field">Endereço de atendimento (opcional)
                <input name="address" defaultValue={barber.endereco ?? ""} maxLength={240} disabled={busy} />
              </label>
              <label className="field">Link HTTPS da foto (opcional)
                <input inputMode="url" name="photo" defaultValue={barber.foto_pixel ?? ""} maxLength={2048} disabled={busy} />
              </label>
              <BarberPhotoInput disabled={busy} />
              <button type="submit" className="secondary" disabled={busy}>Salvar dados</button>
            </form>}
            <button type="button" className="secondary" disabled={busy} onClick={() => deleteBarber(barber)}>
              Excluir barbeiro
            </button>
          </li>
        ))}</ul>}
      </section>}

      {section === "suggestions" && <section className="card-modern space-y-4">
        <h2>Sugestões dos clientes</h2>
        <label className="flex items-center gap-2"><input type="checkbox" checked={reviewed} disabled={busy}
          onChange={(event) => { setReviewed(event.target.checked); setSuggestionPage(0); }} /> Mostrar sugestões revisadas</label>
        {!loading && !loadError && <>
          {suggestions.length === 0 && <p className="muted">Nenhuma sugestão nesta página.</p>}
          {suggestions.map((suggestion) => (
            <article key={suggestion.id} className="space-y-2 border-t border-white/10 pt-3">
              <time className="muted text-sm" dateTime={suggestion.created_at}>{clubDateTime.format(new Date(suggestion.created_at))}</time>
              <p className="whitespace-pre-wrap break-words">{suggestion.body}</p>
              {!suggestion.reviewed_at && <button type="button" className="secondary" disabled={busy}
                onClick={() => void mutate(() => db.from("club_suggestions").update({ reviewed_at: new Date().toISOString() }).eq("id", suggestion.id))}>Marcar como revisada</button>}
            </article>
          ))}
          <div className="flex flex-wrap gap-2">
            {suggestionPage > 0 && <button type="button" className="secondary" disabled={busy} onClick={() => setSuggestionPage(suggestionPage - 1)}>Página anterior</button>}
            {hasMoreSuggestions && <button type="button" className="secondary" disabled={busy} onClick={() => setSuggestionPage(suggestionPage + 1)}>Próxima página</button>}
          </div>
        </>}
      </section>}
    </div>
  );
}
