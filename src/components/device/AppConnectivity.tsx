"use client";

import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";

export function AppConnectivity() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    function updateStatus() { setOffline(!navigator.onLine); }
    updateStatus();
    window.addEventListener("online", updateStatus);
    window.addEventListener("offline", updateStatus);

    if (process.env.NODE_ENV === "production" && !Capacitor.isNativePlatform() && "serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    return () => {
      window.removeEventListener("online", updateStatus);
      window.removeEventListener("offline", updateStatus);
    };
  }, []);

  if (!offline) return null;
  return (
    <p role="status" className="bg-[#e88b2e] px-4 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-center text-sm font-semibold text-[#12141a]">
      Sem conexão. Reconecte-se para acessar sua conta, a agenda e os pontos.
    </p>
  );
}
