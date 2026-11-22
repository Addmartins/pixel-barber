let context: AudioContext | undefined;

export function unlockGameAudio() {
  try {
    if (typeof AudioContext !== "function") return;
    context ??= new AudioContext();
    if (context.state === "suspended") void context.resume().catch(() => {});
  } catch {
    // Audio is optional on browsers with blocked playback.
  }
}

function tone(type: OscillatorType, from: number, to: number, duration: number, delay = 0, signal?: AbortSignal) {
  if (!context || context.state !== "running" || signal?.aborted) return;
  const oscillator = context.createOscillator();
  const volume = context.createGain();
  const start = context.currentTime + delay;
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(from, start);
  oscillator.frequency.exponentialRampToValueAtTime(to, start + duration);
  volume.gain.setValueAtTime(.04, start);
  volume.gain.exponentialRampToValueAtTime(.001, start + duration);
  oscillator.connect(volume).connect(context.destination);
  const cancel = () => {
    oscillator.disconnect();
    volume.disconnect();
  };
  signal?.addEventListener("abort", cancel, { once: true });
  oscillator.onended = () => {
    signal?.removeEventListener("abort", cancel);
    cancel();
  };
  oscillator.start(start);
  oscillator.stop(start + duration);
}

export function playJumpSound(signal?: AbortSignal) { tone("square", 150, 380, .08, 0, signal); }
export function playScoreSound(signal?: AbortSignal) {
  tone("triangle", 523, 523, .055, 0, signal);
  tone("triangle", 659, 659, .06, .06, signal);
}
export function playHitSound(signal?: AbortSignal) { tone("sawtooth", 180, 45, .15, 0, signal); }
export function playVictoryJingle(signal?: AbortSignal) {
  [523, 659, 784, 1047].forEach((note, index) => tone("square", note, note, .105, index * .09, signal));
}
