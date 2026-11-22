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

function tone(type: OscillatorType, from: number, to: number, duration: number, delay = 0) {
  if (!context || context.state !== "running") return;
  const oscillator = context.createOscillator();
  const volume = context.createGain();
  const start = context.currentTime + delay;
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(from, start);
  oscillator.frequency.exponentialRampToValueAtTime(to, start + duration);
  volume.gain.setValueAtTime(.04, start);
  volume.gain.exponentialRampToValueAtTime(.001, start + duration);
  oscillator.connect(volume).connect(context.destination);
  oscillator.onended = () => { oscillator.disconnect(); volume.disconnect(); };
  oscillator.start(start);
  oscillator.stop(start + duration);
}

export function playJumpSound() { tone("square", 150, 380, .08); }
export function playScoreSound() {
  tone("triangle", 523, 523, .055);
  tone("triangle", 659, 659, .06, .06);
}
export function playHitSound() { tone("sawtooth", 180, 45, .15); }
export function playVictoryJingle() {
  [523, 659, 784, 1047].forEach((note, index) => tone("square", note, note, .105, index * .09));
}
