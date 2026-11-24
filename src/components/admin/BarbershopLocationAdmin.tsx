"use client";

import { useEffect, useState, type FormEvent } from "react";
import { MapPin, Navigation, Save } from "lucide-react";
import { getSupabase } from "@/lib/supabase/browser";

type LocationData = {
  city: string;
  latitude: number;
  longitude: number;
  radius_km: number;
};

export function BarbershopLocationAdmin() {
  const [data, setData] = useState<LocationData>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ error: boolean; text: string }>();

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const supabase = getSupabase();
        const res = await supabase?.rpc("get_barbershop_location");
        if (!res || res.error) throw new Error();
        if (active && res.data?.[0]) {
          setData(res.data[0]);
        }
      } catch {
        if (active) setStatus({ error: true, text: "Não foi possível carregar a localização da barbearia." });
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    const form = new FormData(event.currentTarget);
    const city = String(form.get("city") ?? "").trim();
    const lat = parseFloat(String(form.get("latitude") ?? ""));
    const lng = parseFloat(String(form.get("longitude") ?? ""));
    const radius = parseFloat(String(form.get("radius") ?? ""));

    if (!city || isNaN(lat) || isNaN(lng) || isNaN(radius) || radius <= 0) {
      setStatus({ error: true, text: "Preencha todos os campos com valores válidos." });
      return;
    }

    setSaving(true);
    setStatus(undefined);

    try {
      const supabase = getSupabase();
      const res = await supabase?.rpc("update_barbershop_location", {
        p_city: city,
        p_latitude: lat,
        p_longitude: lng,
        p_radius_km: radius,
      });

      if (!res || res.error) throw new Error(res?.error?.message ?? "Falha ao salvar");

      setData({ city, latitude: lat, longitude: lng, radius_km: radius });
      setStatus({ error: false, text: "Localização da barbearia atualizada com sucesso!" });
    } catch (err: unknown) {
      setStatus({ error: true, text: err instanceof Error ? err.message : "Erro ao atualizar localização." });
    } finally {
      setSaving(false);
    }
  }

  function useCurrentGps(form: HTMLFormElement) {
    if (!navigator.geolocation) {
      setStatus({ error: true, text: "Geolocalização não suportada pelo navegador." });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const latInput = form.elements.namedItem("latitude") as HTMLInputElement | null;
        const lngInput = form.elements.namedItem("longitude") as HTMLInputElement | null;
        if (latInput) latInput.value = pos.coords.latitude.toFixed(6);
        if (lngInput) lngInput.value = pos.coords.longitude.toFixed(6);
        setStatus({ error: false, text: "Coordenadas GPS atuais capturadas! Clique em Salvar para aplicar." });
      },
      () => setStatus({ error: true, text: "Não foi possível obter a localização atual do GPS." })
    );
  }

  return (
    <section className="card-modern space-y-4">
      <div className="flex items-center gap-2">
        <MapPin size={20} className="text-amber-400" />
        <h2 className="text-base font-bold">Localização da Barbearia (Geofencing de Portfólio)</h2>
      </div>

      <p className="muted text-sm">
        Clientes dentro do raio configurado têm acesso aos barbeiros e agendamento real. Visitantes de outras regiões vêem a demonstração de portfólio.
      </p>

      {loading ? (
        <p role="status">Carregando configuração de localização…</p>
      ) : (
        <form className="space-y-3" onSubmit={handleSave} ref={(form) => {
          // Preenchimento de defaults caso data exista
          if (form && data) {
            const cityInput = form.elements.namedItem("city") as HTMLInputElement | null;
            const latInput = form.elements.namedItem("latitude") as HTMLInputElement | null;
            const lngInput = form.elements.namedItem("longitude") as HTMLInputElement | null;
            const radInput = form.elements.namedItem("radius") as HTMLInputElement | null;
            if (cityInput && !cityInput.value) cityInput.value = data.city;
            if (latInput && !latInput.value) latInput.value = String(data.latitude);
            if (lngInput && !lngInput.value) lngInput.value = String(data.longitude);
            if (radInput && !radInput.value) radInput.value = String(data.radius_km);
          }
        }}>
          <label className="field">
            Cidade / Região
            <input name="city" defaultValue={data?.city ?? "João Pessoa / PB"} maxLength={100} required disabled={saving} />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="field">
              Latitude
              <input name="latitude" type="number" step="any" defaultValue={data?.latitude ?? -7.1195} required disabled={saving} />
            </label>
            <label className="field">
              Longitude
              <input name="longitude" type="number" step="any" defaultValue={data?.longitude ?? -34.8450} required disabled={saving} />
            </label>
          </div>

          <label className="field">
            Raio de liberação (km)
            <input name="radius" type="number" step="any" min="1" max="500" defaultValue={data?.radius_km ?? 60} required disabled={saving} />
          </label>

          {status && (
            <p className={status.error ? "error text-sm" : "muted text-sm text-emerald-400"} role={status.error ? "alert" : "status"}>
              {status.text}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <button type="submit" className="primary flex items-center gap-2" disabled={saving}>
              <Save size={16} />
              {saving ? "Salvando…" : "Salvar localização"}
            </button>
            <button
              type="button"
              className="secondary flex items-center gap-2 text-xs"
              disabled={saving}
              onClick={(e) => useCurrentGps(e.currentTarget.form!)}
            >
              <Navigation size={14} />
              Usar meu GPS atual
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
