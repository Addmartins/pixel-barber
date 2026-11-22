"use client";

import { useEffect, useState } from "react";
import { useAppUpdates } from "./useAppUpdates";

export function AppConnectivity() {
  const [offline, setOffline] = useState(false);
  const update = useAppUpdates();

  useEffect(() => {
    function updateStatus() { setOffline(!navigator.onLine); }
    updateStatus();
    window.addEventListener("online", updateStatus);
    window.addEventListener("offline", updateStatus);

    return () => {
      window.removeEventListener("online", updateStatus);
      window.removeEventListener("offline", updateStatus);
    };
  }, []);

  if (!offline && !update) return null;
  return (
    <div className="device-notice" role="status">
      {offline ? <span>Sem conexão. Reconecte-se para acessar sua conta, a agenda e os pontos.</span>
        : update?.platform === "web" ? <>
          <span>Nova versão disponível.</span>
          <button type="button" onClick={() => window.location.reload()}>Atualizar agora</button>
        </> : update?.platform === "android" ? <>
          <span>Pixel Barber {update.version} disponível.</span>
          <a href={update.href} target="_blank" rel="noopener noreferrer">Baixar APK</a>
        </> : null}
    </div>
  );
}
