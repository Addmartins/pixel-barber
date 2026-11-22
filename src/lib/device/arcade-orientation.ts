import { Capacitor } from "@capacitor/core";
import { ScreenOrientation } from "@capacitor/screen-orientation";

export function landscapeForArcade() {
  const native = Capacitor.isNativePlatform();
  const root = document.documentElement;
  let ownsFullscreen = false;
  let locked = false;
  const request = (async () => {
    if (!native) {
      if (!matchMedia("(pointer: coarse)").matches || !document.fullscreenEnabled) return;
      if (!document.fullscreenElement) {
        await root.requestFullscreen({ navigationUI: "hide" });
        ownsFullscreen = document.fullscreenElement === root;
      }
    }
    await ScreenOrientation.lock({ orientation: "landscape" });
    locked = true;
  })().catch(() => { /* The game also has a touch layout when rotation is unavailable. */ });

  return async () => {
    await request;
    if (locked) await ScreenOrientation.unlock().catch(() => {});
    if (ownsFullscreen && document.fullscreenElement === root) await document.exitFullscreen().catch(() => {});
  };
}
