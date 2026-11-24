"use client";

import { useEffect, useState } from "react";
import { MapPin, Navigation, ShieldAlert, Sparkles } from "lucide-react";
import { getSupabase } from "@/lib/supabase/browser";
import { ClubAccessRequest } from "@/components/auth/ClubAccessRequest";

type LocationAccessGateProps = {
  clientId: string;
  onApproved: () => void;
  onTestDemo?: () => void;
  title: string;
  description: string;
};

export function LocationAccessGate({
  clientId,
  onApproved,
  onTestDemo,
  title,
  description,
}: LocationAccessGateProps) {
  const [status, setStatus] = useState<"idle" | "checking" | "approved" | "outside" | "denied" | "error">("idle");
  const [distanceKm, setDistanceKm] = useState<number>();
  const [city, setCity] = useState<string>();
  const [errorMsg, setErrorMsg] = useState("");

  async function checkLocation() {
    if (!navigator.geolocation) {
      setStatus("error");
      setErrorMsg("Geolocalização não é suportada por este dispositivo.");
      return;
    }

    setStatus("checking");
    setErrorMsg("");

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const supabase = getSupabase();
          if (!supabase) throw new Error("Sessão indisponível");

          const res = await supabase.rpc("verify_location_access", {
            p_lat: pos.coords.latitude,
            p_lng: pos.coords.longitude,
          });

          if (!res || res.error) throw new Error(res?.error?.message ?? "Falha na verificação");

          const result = res.data?.[0];
          if (result?.granted) {
            setStatus("approved");
            setCity(result.city);
            onApproved();
          } else {
            setStatus("outside");
            setDistanceKm(result?.distance_km);
            setCity(result?.city);
          }
        } catch (err: unknown) {
          setStatus("error");
          setErrorMsg(err instanceof Error ? err.message : "Erro ao verificar localização no servidor.");
        }
      },
      (err) => {
        if (err.code === 1) {
          setStatus("denied");
        } else {
          setStatus("error");
          setErrorMsg("Não foi possível obter a posição do GPS.");
        }
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }

  // Tenta checar automaticamente no mount se o navegador já tiver permissão
  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.permissions) {
      navigator.permissions.query({ name: "geolocation" }).then((perm) => {
        if (perm.state === "granted") {
          void checkLocation();
        }
      }).catch(() => { /* Sem suporte a permissions query */ });
    }
  }, []);

  return (
    <div className="card-modern space-y-4 text-center">
      <div className="mx-auto grid size-12 place-items-center rounded-full bg-amber-500/10 text-amber-400">
        <MapPin size={24} aria-hidden="true" />
      </div>

      <div className="space-y-1">
        <h2 className="text-lg font-bold">{title}</h2>
        <p className="muted text-sm">{description}</p>
      </div>

      {status === "checking" && (
        <div className="flex items-center justify-center gap-2 text-sm text-cyan-400" role="status">
          <Navigation className="animate-spin" size={16} />
          <span>Consultando GPS e proximidade da barbearia…</span>
        </div>
      )}

      {status === "approved" && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300" role="status">
          <p>✓ Localização confirmada em <strong>{city}</strong>! Seu acesso foi liberado.</p>
        </div>
      )}

      {status === "outside" && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200" role="status">
          <p className="font-semibold">Você está fora da região da barbearia</p>
          <p className="text-xs mt-1 text-amber-300/80">
            Aproximadamente <strong>{distanceKm} km</strong> de distância de {city}.
            Como este é um projeto de portfólio, os barbeiros e a agenda real ficam restritos aos clientes locais.
          </p>
        </div>
      )}

      {status === "denied" && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200" role="status">
          <p className="font-semibold">Permissão de localização não concedida</p>
          <p className="text-xs mt-1 text-red-300/80">
            Habilite a localização no navegador para liberar os barbeiros automaticamente, ou solicite acesso manual abaixo.
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
          <span>Ou solicite liberação manual para o administrador:</span>
        </div>
        <ClubAccessRequest key={clientId} />
        <button
          type="button"
          className="secondary w-full text-xs"
          onClick={onApproved}
        >
          Já foi aprovado? Atualizar permissão
        </button>
      </div>
    </div>
  );
}
