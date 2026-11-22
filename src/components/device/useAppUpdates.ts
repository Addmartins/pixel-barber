"use client";

import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { deviceApi } from "@/lib/device/api";
import current from "@/lib/device/release.json";

type Update = { platform: "web" } | { platform: "android"; href: string; version: string };
const checkEveryMs = 5 * 60 * 1000;

export function useAppUpdates() {
  const [update, setUpdate] = useState<Update | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    const platform = Capacitor.getPlatform();
    if (platform !== "web" && platform !== "android") return;
    const mountedBuild = process.env.NEXT_PUBLIC_PIXEL_BARBER_BUILD;
    const lifetime = new AbortController();
    let checking = false;
    let registration: ServiceWorkerRegistration | undefined;
    let lastCheckedAt = 0;

    if (platform === "web" && "serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" })
        .then((installed) => { registration = installed; })
        .catch(() => {});
    }

    async function check() {
      if (checking || !navigator.onLine || document.visibilityState !== "visible" ||
          Date.now() - lastCheckedAt < 10_000) return;
      lastCheckedAt = Date.now();
      checking = true;

      try {
        const endpoint = deviceApi("/api/release");
        const response = await fetch(`${endpoint}?at=${lastCheckedAt}`, {
          cache: "no-store", signal: lifetime.signal,
        });
        if (!response.ok) return;
        const release = await response.json();
        if (lifetime.signal.aborted) return;
        if (platform === "web") {
          setUpdate(mountedBuild && typeof release.webBuild === "string" && release.webBuild !== mountedBuild
            ? { platform: "web" } : null);
          void registration?.update().catch(() => {});
        } else if (Number.isInteger(release.androidVersionCode) && release.androidVersionCode > current.androidVersionCode &&
                   release.androidDownload === current.androidDownload && typeof release.androidVersionName === "string") {
          const href = new URL(endpoint).origin + current.androidDownload;
          setUpdate({ platform: "android", href, version: release.androidVersionName });
        } else {
          setUpdate(null);
        }
      } catch {
        // Offline or unreachable host. The next foreground or timer retries.
      } finally {
        checking = false;
      }
    }

    void check();
    const timer = window.setInterval(check, checkEveryMs);
    window.addEventListener("online", check);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      lifetime.abort();
      window.clearInterval(timer);
      window.removeEventListener("online", check);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);

  return update;
}
