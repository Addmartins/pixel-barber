"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Gamepad2, Scissors, Timer, TrendingUp } from "lucide-react";
import { createGame } from "@/lib/games";
import { finishRun, getArcadeStats, startRun } from "@/lib/games/client";
import {
  A, B, canvasHeight, canvasWidth, difficulties, DOWN, LEFT, multipliers, RIGHT, roundSeconds, ticksPerSecond, UP,
  type Difficulty, type GameCode, type GameResult, type GameState, type InputChange, type Run,
} from "@/lib/games/types";
import { GameBoyFrame } from "./GameBoyFrame";
import "./arcade.css";

const cartridges = [
  { code: "NAVALHA_RUSH", title: "Navalha Rush", icon: Scissors, accent: "mint",
    instructions: "Use as direções para coletar pomadas (+10). Toalhas quentes (+50) deixam os inimigos azuis para você encadear combos." },
  { code: "BARBA_FIGHTER", title: "Barba Fighter II", icon: TrendingUp, accent: "rose",
    instructions: "Segure a direção indicada para esquivar. Depois toque A (tesoura) ou B (navalha) conforme o sinal. Após cinco acertos, use B para o Corte Turbo. No nível Mestre, faça os dois cortes na ordem mostrada." },
  { code: "TORRE_FADE", title: "Torre do Fade", icon: Timer, accent: "gold",
    instructions: "Use ◀ e ▶ para se mover e A ou ▲ para pular. Atravesse as esteiras e as poças de xampu para chegar ao topo antes que o tempo acabe." },
] as const;

const keyboard: Partial<Record<string, number>> = {
  ArrowLeft: LEFT, ArrowRight: RIGHT, ArrowUp: UP, ArrowDown: DOWN,
  KeyZ: B, Space: A, KeyX: A,
};

const levels: Record<Difficulty, { title: string; subtitle: string; description: string }> = {
  EASY: { title: "Iniciante", subtitle: "Fade Suave", description: "Para quem está pegando a navalha pela primeira vez." },
  MEDIUM: { title: "Experiente", subtitle: "Corte Preciso", description: "Para barbeiros que já dominam o degradê." },
  HARD: { title: "Mestre", subtitle: "Navalha de Ouro", description: "Apenas para lendas do salão. Pontuação máxima!" },
};

function playBootChime() {
  if (typeof window.AudioContext !== "function") return;
  try {
    const audio = new AudioContext();
    void audio.resume().then(() => {
      const tone = audio.createOscillator();
      const gain = audio.createGain();
      const start = audio.currentTime + 1.12;
      tone.type = "square";
      tone.frequency.setValueAtTime(523.25, start);
      tone.frequency.setValueAtTime(784, start + 0.075);
      gain.gain.setValueAtTime(0.045, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);
      tone.connect(gain).connect(audio.destination);
      tone.onended = () => void audio.close();
      tone.start(start);
      tone.stop(start + 0.21);
    }).catch(() => { void audio.close(); });
  } catch {
    // The visual boot screen is also available on devices without audio.
  }
}

type FinishedRun = { run: Run; snapshot: GameState; changes: InputChange[] };
type Phase = "idle" | "starting" | "playing" | "finished";
const tickMs = 1000 / ticksPerSecond;

export function Arcade({ demo, visible, onBalance }: {
  demo: boolean;
  visible: boolean;
  onBalance: (balance: number) => void;
}) {
  const [selected, setSelected] = useState<GameCode>("NAVALHA_RUSH");
  const [difficulty, setDifficulty] = useState<Difficulty>("EASY");
  const [booting, setBooting] = useState(false);
  const [run, setRun] = useState<Run | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [snapshot, setSnapshot] = useState<GameState | null>(null);
  const [best, setBest] = useState<Partial<Record<GameCode, number>>>({});
  const [credited, setCredited] = useState<number | null>(null);
  const [result, setResult] = useState<GameResult | null>(null);
  const [pending, setPending] = useState<FinishedRun | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [statsError, setStatsError] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const held = useRef(new Map<number | string, number>());
  const justPressed = useRef(0);
  const cartridge = cartridges.find(({ code }) => code === selected) ?? cartridges[0];
  const playing = phase === "playing";
  const controlsLocked = playing || phase === "starting" || sending || Boolean(pending) || booting;
  const activeDifficulty = run?.difficulty ?? difficulty;
  const points = result?.score ?? Math.round((snapshot?.score ?? 0) * multipliers[activeDifficulty]);
  const remaining = Math.max(0, roundSeconds(selected, activeDifficulty) - Math.floor((snapshot?.ticks ?? 0) / ticksPerSecond));

  useEffect(() => {
    if (!booting) return;
    const timer = window.setTimeout(() => setBooting(false), 1500);
    return () => window.clearTimeout(timer);
  }, [booting]);

  const onInput = useCallback((key: number | string, bit: number) => {
    if (bit) {
      if (!held.current.has(key)) justPressed.current |= bit;
      held.current.set(key, bit);
    } else held.current.delete(key);
  }, []);

  useEffect(() => {
    if (demo || !visible || phase !== "idle") return;
    let active = true;
    getArcadeStats().then((stats) => {
      if (!active) return;
      setStatsError(false);
      setBest(Object.fromEntries(stats.records.map(({ game_code, high_score }) => [game_code, high_score])));
      setCredited(stats.credited_today);
    }).catch(() => { if (active) setStatsError(true); });
    return () => { active = false; };
  }, [demo, visible, phase]);

  useEffect(() => {
    if (!playing || !visible) return;
    function keydown(event: KeyboardEvent) {
      const bit = keyboard[event.code];
      if (!bit || event.defaultPrevented) return;
      event.preventDefault();
      onInput(event.code, bit);
    }
    function keyup(event: KeyboardEvent) { onInput(event.code, 0); }
    function reset() { held.current.clear(); justPressed.current = 0; }
    function visibilityChange() { if (document.hidden) reset(); }
    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);
    window.addEventListener("blur", reset);
    document.addEventListener("visibilitychange", visibilityChange);
    return () => {
      reset();
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
      window.removeEventListener("blur", reset);
      document.removeEventListener("visibilitychange", visibilityChange);
    };
  }, [playing, visible, onInput]);

  const save = useCallback(async (finished: FinishedRun) => {
    setSending(true);
    setError("");
    try {
      const saved = await finishRun(finished.run.id, finished.snapshot.ticks, finished.changes);
      setResult(saved);
      setPending(null);
      setBest((previous) => ({ ...previous, [finished.run.game]: saved.high_score }));
      setCredited(saved.credited_today);
      onBalance(saved.points_balance);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Não foi possível salvar a partida.");
    } finally {
      setSending(false);
    }
  }, [onBalance]);

  useEffect(() => {
    if (!run) return;
    const context = canvas.current?.getContext("2d");
    if (!context) {
      setPhase("finished");
      setError("Seu navegador não disponibilizou o Canvas 2D.");
      return;
    }
    context.imageSmoothingEnabled = false;
    const engine = createGame(run.game, run.seed, run.difficulty);
    const changes: InputChange[] = [];
    let previousMask = 0;
    let previousTime = performance.now();
    let accumulator = 0;
    let frame = 0;
    let displayedScore = -1;
    let displayedSecond = -1;

    function loop(time: number) {
      accumulator += Math.min(100, time - previousTime);
      previousTime = time;
      while (accumulator >= tickMs && engine.state.status === "playing") {
        let mask = justPressed.current;
        justPressed.current = 0;
        for (const bit of held.current.values()) mask |= bit;
        if (mask !== previousMask) {
          changes.push([engine.state.ticks, mask]);
          previousMask = mask;
        }
        engine.step(mask);
        accumulator -= tickMs;
      }
      engine.draw(context!);
      const { score, status, ticks } = engine.state;
      const second = Math.floor(ticks / ticksPerSecond);
      if (score !== displayedScore || second !== displayedSecond || status !== "playing") {
        setSnapshot({ score, status, ticks });
        displayedScore = score;
        displayedSecond = second;
      }
      if (status === "playing") {
        frame = requestAnimationFrame(loop);
        return;
      }
      setPhase("finished");
      if (demo) setBest((previous) => ({ ...previous, [run!.game]: Math.max(previous[run!.game] ?? 0, Math.round(score * multipliers[run!.difficulty])) }));
      else {
        const finished = { run: run!, snapshot: { score, status, ticks }, changes };
        setPending(finished);
        void save(finished);
      }
    }
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [run, demo, save]);

  const start = useCallback(async () => {
    if (controlsLocked) return;
    setError("");
    setResult(null);
    setPending(null);
    setSnapshot(null);
    setRun(null);
    held.current.clear();
    justPressed.current = 0;
    setPhase("starting");
    try {
      const next = demo
        ? { id: "demo", seed: 1 + Math.floor(Math.random() * 2147483646), game: selected, difficulty }
        : await startRun(selected, difficulty);
      setRun(next);
      setPhase("playing");
    } catch (failure) {
      setPhase("idle");
      setError(failure instanceof Error ? failure.message : "Não foi possível iniciar.");
    }
  }, [controlsLocked, demo, selected, difficulty]);

  function select(code: GameCode) {
    setSelected(code);
    setBooting(true);
    playBootChime();
    setRun(null);
    setSnapshot(null);
    setResult(null);
    setError("");
    setPhase("idle");
  }

  function selectDifficulty(level: Difficulty) {
    setDifficulty(level);
    setRun(null);
    setSnapshot(null);
    setResult(null);
    setError("");
    setPhase("idle");
  }

  const cycleDifficulty = useCallback(() => {
    if (controlsLocked) return;
    selectDifficulty(difficulties[(difficulties.indexOf(difficulty) + 1) % difficulties.length]);
  }, [controlsLocked, difficulty]);

  useEffect(() => {
    if (!visible) return;
    function menuKeys(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat) return;
      if (event.key === "Shift" && !controlsLocked) {
        event.preventDefault();
        cycleDifficulty();
      }
      if (event.key === "Enter" && !controlsLocked && (!(event.target instanceof HTMLButtonElement) || event.target.closest(".arcade-cartridges"))) {
        event.preventDefault();
        void start();
      }
    }
    window.addEventListener("keydown", menuKeys);
    return () => window.removeEventListener("keydown", menuKeys);
  }, [visible, controlsLocked, cycleDifficulty, start]);
  return (
    <section className="arcade-games" aria-labelledby="arcade-title">
      <h2 id="arcade-title">Fliperama</h2>
      <div className="arcade-cartridges" role="group" aria-label="Escolha um cartucho">
        {cartridges.map(({ code, title, icon: Icon, accent }) => (
          <button key={code} type="button" data-accent={accent} aria-pressed={selected === code}
            disabled={controlsLocked} onClick={() => select(code)}>
            <Icon size={20} aria-hidden="true" /> {title}
          </button>
        ))}
      </div>
      <p className="muted">{cartridge.instructions}</p>
      {demo ? <p className="muted">Demonstração com recordes nesta sessão.</p>
        : <p className="muted">{credited === null ? "Até três partidas com pontos por dia." : `${credited}/3 partidas creditadas hoje, no horário de Brasília.`}</p>}
      {statsError && <p className="error">Os recordes salvos estão indisponíveis no momento.</p>}

      <GameBoyFrame playing={playing} onInput={onInput} onStart={() => void start()} onSelect={cycleDifficulty}
        startDisabled={controlsLocked} selectDisabled={controlsLocked}>
        <div className="arcade-scoreboard">
          <span>PLACAR <strong>{points}</strong></span>
          <span>RECORDE <strong>{best[selected] ?? 0}</strong></span>
          <span>TEMPO <strong>{remaining}s</strong></span>
        </div>
        <div className="arcade-display">
          <canvas ref={canvas} width={canvasWidth} height={canvasHeight} role="img"
            aria-label={`Tela de ${cartridge.title}`} />
          {booting ? <div className="arcade-boot" role="status"><strong>PIXEL BARBER</strong></div> :
            !run && <div className="arcade-title-screen">
              <Gamepad2 size={28} aria-hidden="true" />
              <strong>{cartridge.title}</strong>
              <span className="arcade-lcd-level">{levels[difficulty].subtitle} · {String(multipliers[difficulty]).replace(".", ",")}×</span>
            </div>}
        </div>
      </GameBoyFrame>
      <fieldset className="arcade-difficulty" disabled={controlsLocked}>
        <legend>Dificuldade</legend>
        <div className="arcade-levels">
          {difficulties.map((level) => (
            <label key={level}>
              <input type="radio" className="sr-only" name="arcade-difficulty" checked={difficulty === level}
                onChange={() => selectDifficulty(level)} />
              <span>{levels[level].title} <strong>{multipliers[level].toFixed(1).replace(".", ",")}×</strong></span>
            </label>
          ))}
        </div>
        <p className="muted">{levels[difficulty].description}</p>
      </fieldset>
      <p className="muted arcade-keys">Teclado: setas, Z = B, X ou Espaço = A, Enter = START, Shift = SELECT.</p>
      {phase === "finished" && snapshot && <p role="status" className="arcade-result">
        {snapshot.status === "won" ? "Você venceu!" : "Fim de jogo."} {points} pontos de placar.
        {result && (result.points_awarded > 0 ? ` +${result.points_awarded} pontos no seu saldo.` :
          result.score > 0 ? " Limite diário atingido. A partida contou para o recorde." : " Nenhum ponto creditado.")}
      </p>}
      {error && <p role="alert" className="error">{error}</p>}
      {pending && !sending && (
        <div className="arcade-retry">
          <button type="button" className="primary" onClick={() => void save(pending)}>Reenviar resultado</button>
          <button type="button" className="secondary" onClick={() => { setPending(null); setError(""); }}>Fechar resultado</button>
        </div>
      )}
      {!playing && !pending && <button type="button" className="primary w-full" disabled={controlsLocked}
        onClick={() => void start()}>{phase === "starting" ? "Carregando cartucho…" : phase === "finished" ? "Jogar novamente" : "Iniciar partida"}</button>}
      {sending && <p role="status">Validando partida…</p>}
    </section>
  );
}
