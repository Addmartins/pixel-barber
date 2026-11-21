import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";

function vibrate(pattern: number | number[]) {
  if (typeof navigator === "undefined") return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Some browsers suppress vibration based on device settings or page state.
  }
}

function feedback(pattern: number | number[], nativeFeedback: () => Promise<void>) {
  if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("Haptics")) {
    void nativeFeedback().catch(() => vibrate(pattern));
    return;
  }
  vibrate(pattern);
}

export function hapticTap() {
  feedback(10, () => Haptics.impact({ style: ImpactStyle.Light }));
}

export function hapticAction() {
  feedback(25, () => Haptics.impact({ style: ImpactStyle.Medium }));
}

export function hapticImpact() {
  feedback([40, 30, 40], () => Haptics.notification({ type: NotificationType.Error }));
}

export function hapticVictory() {
  feedback([30, 50, 30, 50, 80], () => Haptics.notification({ type: NotificationType.Success }));
}
