"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Gamepad2, Scissors, Timer, TrendingUp } from "lucide-react";
import { createGame } from "@/lib/games";
import { finishRun, getArcadeStats, startRun } from "@/lib/games/client";
import {
  A, B, canvasHeight, canvasWidth, DOWN, LEFT, RIGHT, ticksPerSecond, UP,
  type GameCode, type GameResult, type GameState, type InputChange, type Run,
} from "@/lib/games/types";
import { ArcadeFrame } from "./ArcadeFrame";
import "./arcade.css";

const cartridges = [
  { code: "NAVALHA_RUSH", title: "Navalha Rush", icon: Scissors, accent: "mint",
    instructions: "Use as direções para coletar pomadas (+10). Toalhas quentes (+50) deixam os inimigos azuis para você encadear combos." },
  { code: "BARBA_FIGHTER", title: "Barba Fighter II", icon: TrendingUp, accent: "rose",
    instructions: "Segure a direção indicada para esquivar. Depois toque A (tesoura) ou B (navalha) conforme o sinal. Após cinco acertos, use B para o Corte Turbo." },
  { code: "TORRE_FADE", title: "Torre do Fade", icon: Timer, accent: "gold",
    instructions: "Use ◀ e ▶ para se mover e A ou ▲ para pular. Atravesse as esteiras e as poças de xampu para chegar ao topo em até 60 segundos." },
] as const;

const keyboard: Partial<Record<string, number>> = {
  ArrowLeft: LEFT, ArrowRight: RIGHT, ArrowUp: UP, ArrowDown: DOWN,
  KeyZ: A, Space: A, KeyX: B,
};

type FinishedRun = { run: Run; snapshot: GameState; changes: InputChange[] };
type Phase = "idle" | "starting" | "playing" | "finished";
const tickMs = 1000 / ticksPerSecond;

export function Arcade({ demo, visible, onBalance }: {
  demo: boolean;
  visible: boolean;
  onBalance: (balance: number) => void;
}) {
  const [selected, setSelected] = useState<GameCode>("NAVALHA_RUSH");
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
      if (!bit || (event.code === "Space" && event.target instanceof HTMLButtonElement)) return;
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
    const engine = createGame(run.game, run.seed);
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
      if (demo) setBest((previous) => ({ ...previous, [run!.game]: Math.max(previous[run!.game] ?? 0, score) }));
      else {
        const finished = { run: run!, snapshot: { score, status, ticks }, changes };
        setPending(finished);
        void save(finished);
      }
    }
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [run, demo, save]);

  async function start() {
    if (phase === "starting" || playing || sending) return;
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
        ? { id: "demo", seed: 1 + Math.floor(Math.random() * 2147483646), game: selected }
        : await startRun(selected);
      setRun(next);
      setPhase("playing");
    } catch (failure) {
      setPhase("idle");
      setError(failure instanceof Error ? failure.message : "Não foi possível iniciar.");
    }
  }

  function select(code: GameCode) {
    setSelected(code);
    setRun(null);
    setSnapshot(null);
    setResult(null);
    setError("");
    setPhase("idle");
  }

  const controlsLocked = playing || phase === "starting" || sending || Boolean(pending);
  const remaining = Math.max(0, 60 - Math.floor((snapshot?.ticks ?? 0) / ticksPerSecond));
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

      <ArcadeFrame playing={playing} onInput={onInput}>
        <div className="arcade-scoreboard">
          <span>PLACAR <strong>{snapshot?.score ?? 0}</strong></span>
          <span>RECORDE <strong>{best[selected] ?? 0}</strong></span>
          <span>TEMPO <strong>{remaining}s</strong></span>
        </div>
        <div className="arcade-display">
          <canvas ref={canvas} width={canvasWidth} height={canvasHeight} role="img"
            aria-label={`Tela de ${cartridge.title}`} />
          {!run && <div className="arcade-title-screen"><Gamepad2 size={40} aria-hidden="true" /><strong>{cartridge.title}</strong></div>}
        </div>
      </ArcadeFrame>
      <p className="muted arcade-keys">Teclado: setas, Z para A e X para B.</p>
      {phase === "finished" && snapshot && <p role="status" className="arcade-result">
        {snapshot.status === "won" ? "Você venceu!" : "Fim de jogo."} {snapshot.score} pontos de placar.
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
      {!playing && !pending && <button type="button" className="primary w-full" disabled={phase === "starting" || sending}
        onClick={() => void start()}>{phase === "starting" ? "Carregando cartucho…" : phase === "finished" ? "Jogar novamente" : "Iniciar partida"}</button>}
      {sending && <p role="status">Validando partida…</p>}
    </section>
  );
}
