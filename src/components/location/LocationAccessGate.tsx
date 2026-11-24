"use client";

import { Geolocation } from "@capacitor/geolocation";
import { useState } from "react";
import { MapPin, Navigation, ShieldAlert, Sparkles } from "lucide-react";
import { getSupabase } from "@/lib/supabase/browser";
import { ClubAccessRequest } from "@/components/auth/ClubAccessRequest";

type LocationAccessGateProps = {
  clientId: string;
  onRefreshAccess: () => void;
  onTestDemo?: () => void;
  title: string;
  description: string;
};

export function LocationAccessGate({
  clientId,
  onRefreshAccess,
  onTestDemo,
  title,
  description,
}: LocationAccessGateProps) {
  const [status, setStatus] = useState<"idle" | "checking" | "outside" | "denied" | "error">("idle");
  const [city, setCity] = useState<string>();
  const [errorMsg, setErrorMsg] = useState("");

  async function checkLocation() {
    setStatus("checking");
    setErrorMsg("");

    try {
      const { coords } = await Geolocation.getCurrentPosition({
        timeout: 10000, enableHighAccuracy: true, maximumAge: 0,
      });
      const supabase = getSupabase();
      if (!supabase) throw new Error("Sessão indisponível.");
      const { data, error } = await supabase.rpc("verify_location_access", {
        p_lat: coords.latitude,
        p_lng: coords.longitude,
        p_accuracy_m: coords.accuracy,
      });
      if (error || !data?.[0]) throw new Error("Não foi possível verificar o acesso. Tente novamente.");

      const result = data[0];
      setCity(result.city);
      setStatus(result.granted ? "idle" : "outside");
      if (result.granted) onRefreshAccess();
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? error.code : undefined;
      if (code === 1 || code === "OS-PLUG-GLOC-0003" || code === "OS-PLUG-GLOC-0008") {
        setStatus("denied");
      } else {
        setStatus("error");
        setErrorMsg(error instanceof Error ? error.message : "Não foi possível obter a localização do aparelho.");
      }
    }
  }

  return (
    <div className="card-modern space-y-4 text-center">
      <div className="mx-auto grid size-12 place-items-center rounded-full bg-amber-500/10 text-amber-400">
        <MapPin size={24} aria-hidden="true" />
      </div>

      <div className="space-y-1">
        <h2 className="text-lg font-bold">{title}</h2>
        <p className="muted text-sm">{description}</p>
        <p className="muted text-xs">Acesso liberado enquanto esta sessão estiver válida. Suas coordenadas não são armazenadas pelo controle de acesso.</p>
      </div>

      {status === "checking" && (
        <div className="flex items-center justify-center gap-2 text-sm text-cyan-400" role="status">
          <Navigation className="animate-spin" size={16} />
          <span>Consultando GPS e proximidade da barbearia…</span>
        </div>
      )}

      {status === "outside" && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200" role="status">
          <p className="font-semibold">Sua localização na região da barbearia não foi confirmada</p>
          <p className="text-xs mt-1 text-amber-300/80">
            A área de atendimento fica na região de <strong>{city}</strong>. Se estiver em outra região, solicite acesso abaixo.
          </p>
        </div>
      )}

      {status === "denied" && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200" role="status">
          <p className="font-semibold">Permissão de localização não concedida</p>
          <p className="text-xs mt-1 text-red-300/80">
            Habilite a localização para este app para confirmar sua localização, ou solicite acesso manual abaixo.
          </p>
        </div>
      )}

      {status === "error" && errorMsg && (
        <p className="error text-sm" role="alert">{errorMsg}</p>
      )}

      <div className="space-y-2">
        <button
          type="button"
          className="primary w-full flex items-center justify-center gap-2"
          disabled={status === "checking"}
          onClick={() => void checkLocation()}
        >
          <Navigation size={16} />
          {status === "outside" ? "Tentar verificar localização novamente" : "Verificar minha localização via GPS"}
        </button>

        {onTestDemo && (
          <button
            type="button"
            className="secondary w-full flex items-center justify-center gap-2"
            onClick={onTestDemo}
          >
            <Sparkles size={16} />
            Testar com barbearia de demonstração
          </button>
        )}
      </div>

      <div className="border-t border-white/10 pt-4 space-y-2">
        <div className="flex items-center justify-center gap-1 text-xs muted">
          <ShieldAlert size={14} />
          <span>Solicite liberação ao administrador</span>
        </div>
        <ClubAccessRequest key={clientId} />
        <button
          type="button"
          className="secondary w-full text-xs"
          onClick={onRefreshAccess}
        >
          Verificar acesso
        </button>
      </div>
    </div>
  );
}
