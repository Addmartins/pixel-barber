"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Gamepad2, Rocket, Scissors, Timer, TrendingUp } from "lucide-react";
import { AvatarRenderer } from "@/components/avatar/AvatarRenderer";
import type { AvatarId } from "@/lib/avatars";
import type { CosmeticCode } from "@/lib/store";
import { hapticImpact, hapticVictory } from "@/lib/device/haptics";
import { playHitSound, playJumpSound, playScoreSound, playVictoryJingle, unlockGameAudio } from "@/lib/games/audio";
import { createGame } from "@/lib/games";
import { finishRun, getArcadeStats, startRun } from "@/lib/games/client";
import {
  A, canvasHeight, canvasWidth, difficulties, DOWN, gameVersion, LEFT, multipliers, orbitVersion, RIGHT, roundSeconds, ticksPerSecond, UP,
  type Difficulty, type GameCode, type GameResult, type GameState, type InputChange, type Run,
} from "@/lib/games/types";
import { GameBoyFrame } from "./GameBoyFrame";
import { SummitArt, WhiskerArt, SproutArt } from "./RetroCartArt";
import "./arcade.css";

const cartridges = [
  { code: "NAVALHA_RUSH", title: "Patrulha Neon", icon: Scissors, accent: "mint", action: "Rajada", directions: "all",
    instructions: "Mova-se em quatro direções. Toque ou segure Rajada para disparar três feixes e desativar os drones." },
  { code: "ESCALADA_KONG", title: "Salto de Pomada", icon: SummitArt, accent: "amber", action: "Impulso", directions: "horizontal",
    instructions: "Guie o ricochete com esquerda e direita. Use Impulso durante a queda para alcançar cristais e evitar as placas de espinhos." },
  { code: "ORBITA_PIXEL", title: "Órbita Pixel", icon: Rocket, accent: "sky", action: "Laser", directions: "all",
    instructions: "Pilote entre os invasores. Segure Laser para disparar continuamente. O recorde é compartilhado com Patrulha Neon." },
  { code: "BARBA_FIGHTER", title: "Ruínas da Navalha", icon: TrendingUp, accent: "rose", action: "Abrir", directions: "all",
    instructions: "Explore as passagens e colete as pedras preciosas. Use Abrir perto de uma parede para abrir um atalho." },
  { code: "BARBER_VALLEY", title: "Joias do Salão", icon: SproutArt, accent: "lime", action: "Lapidar", directions: "all",
    instructions: "Selecione uma joia com o direcional. Lapidar muda a cor ou coleta grupos de três ou mais joias iguais ligadas pelos lados." },
  { code: "TORRE_FADE", title: "Torre de Neon", icon: Timer, accent: "gold", action: "Soltar", directions: "none",
    instructions: "Solte o bloco quando ele se alinhar à torre. Encaixes precisos rendem mais pontos e preservam a largura." },
  { code: "BIGODE_SNAKE", title: "Bigode Snake", icon: WhiskerArt, accent: "lime", action: undefined, directions: "all",
    instructions: "Guie o avatar com o direcional. Pegue óleos e loções douradas sem tocar na cauda, nas bordas ou nas navalhas." },
] as const;

const keyboard: Partial<Record<string, number>> = {
  ArrowLeft: LEFT, ArrowRight: RIGHT, ArrowUp: UP, ArrowDown: DOWN,
  Space: A, KeyX: A,
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

function currentStatus(state: GameState) { return state.status; }

function remainingHealth(state: ReturnType<typeof createGame>["state"]) {
  if (state.lives !== undefined) return state.lives;
  if ("hearts" in state) return state.hearts;
  return undefined;
}

type FinishedRun = { run: Run; snapshot: GameState; changes: InputChange[] };
type Phase = "idle" | "starting" | "playing" | "finished";
const tickMs = 1000 / ticksPerSecond;

export function Arcade({ demo, visible, onBalance, avatar, cosmetics }: {
  demo: boolean;
  visible: boolean;
  avatar: AvatarId;
  cosmetics: CosmeticCode[];
  onBalance: (balance: number) => void;
}) {
  const [selected, setSelected] = useState<GameCode>("NAVALHA_RUSH");
  const [difficulty, setDifficulty] = useState<Difficulty>("EASY");
  const [opened, setOpened] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
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
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const sprite = useRef<HTMLDivElement>(null);
  const held = useRef(new Map<number | string, number>());
  const justPressed = useRef(new Map<number | string, number>());
  const cartridge = cartridges.find(({ code }) => code === selected) ?? cartridges[0];
  const playing = phase === "playing";
  const controlsLocked = playing || phase === "starting" || sending || Boolean(pending) || booting;
  const activeDifficulty = run?.difficulty ?? difficulty;
  const recordCode = !demo && selected === "ORBITA_PIXEL" ? "NAVALHA_RUSH" : selected;
  const points = result?.score ?? Math.round((snapshot?.score ?? 0) * multipliers[activeDifficulty]);
  const remaining = Math.max(0, roundSeconds(selected, activeDifficulty) - Math.floor((snapshot?.ticks ?? 0) / ticksPerSecond));

  useEffect(() => {
    if (!booting) return;
    const timer = window.setTimeout(() => setBooting(false), 1500);
    return () => window.clearTimeout(timer);
  }, [booting]);

  const onInput = useCallback((key: number | string, bit: number, sweeping = false) => {
    if (sweeping) justPressed.current.delete(key);
    if (bit) {
      if (!held.current.has(key) && !sweeping) justPressed.current.set(key, bit);
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
    if (!playing || !visible || !opened) return;
    function keydown(event: KeyboardEvent) {
      const bit = keyboard[event.code];
      if (!bit || event.defaultPrevented) return;
      event.preventDefault();
      onInput(event.code, bit);
    }
    function keyup(event: KeyboardEvent) { onInput(event.code, 0); }
    function reset() { held.current.clear(); justPressed.current.clear(); }
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
  }, [playing, visible, opened, onInput]);

  const save = useCallback(async (finished: FinishedRun) => {
    setSending(true);
    setError("");
    try {
      const saved = await finishRun(finished.run.id, finished.snapshot.ticks, finished.changes);
      setResult(saved);
      setPending(null);
      setBest((previous) => ({ ...previous, [finished.run.game === "ORBITA_PIXEL" ? "NAVALHA_RUSH" : finished.run.game]: saved.high_score }));
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
    const engine = createGame(run.game, run.seed, run.difficulty, run.engineVersion ?? 2);
    const avatarArt = sprite.current?.querySelector("svg");
    const image = new Image();
    if (avatarArt) {
      const source = avatarArt.cloneNode(true) as SVGElement;
      source.setAttribute("width", "32");
      source.setAttribute("height", "64");
      const svg = new XMLSerializer().serializeToString(source);
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    }
    const changes: InputChange[] = [];
    let previousMask = 0;
    let previousTime = performance.now();
    let accumulator = 0;
    let frame = 0;
    let displayedScore = -1;
    let displayedSecond = -1;
    let health = remainingHealth(engine.state);
    let shake = 0;
    let terminalHit = false;
    const motion = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function loop(time: number) {
      accumulator += Math.min(100, time - previousTime);
      previousTime = time;
      while (accumulator >= tickMs && engine.state.status === "playing") {
        let mask = 0;
        for (const bit of justPressed.current.values()) mask |= bit;
        justPressed.current.clear();
        for (const bit of held.current.values()) mask |= bit;
        if (mask !== previousMask) {
          changes.push([engine.state.ticks, mask]);
          previousMask = mask;
        }
        const beforeScore = engine.state.score;
        const beforeJumps = engine.state.jumps ?? 0;
        engine.step(mask);
        const currentHealth = remainingHealth(engine.state);
        const stepStatus = currentStatus(engine.state);
        const damaged = health !== undefined && currentHealth !== undefined && currentHealth < health;
        health = currentHealth;
        if (damaged || (run?.game === "BARBA_FIGHTER" && (run.engineVersion ?? 2) < 4 && stepStatus === "lost")) {
          terminalHit = stepStatus === "lost";
          if (motion) shake = 4;
          hapticImpact();
          playHitSound();
        }
        if ((engine.state.jumps ?? 0) > beforeJumps) playJumpSound();
        if (engine.state.score > beforeScore && stepStatus === "playing") playScoreSound();
        accumulator -= tickMs;
      }
      const shook = shake > 0;
      if (shook) {
        context!.fillStyle = "#12141a";
        context!.fillRect(0, 0, canvasWidth, canvasHeight);
        context!.save();
        context!.translate(shake % 2 ? -2 : 3, shake % 2 ? 2 : -2);
        engine.draw(context!, image.complete && image.naturalWidth ? image : undefined);
        context!.restore();
        shake--;
      } else {
        engine.draw(context!, image.complete && image.naturalWidth ? image : undefined);
      }
      const { score, status, ticks } = engine.state;
      const second = Math.floor(ticks / ticksPerSecond);
      if (score !== displayedScore || second !== displayedSecond || status !== "playing") {
        setSnapshot({ score, status, ticks });
        displayedScore = score;
        displayedSecond = second;
      }
      if (status === "playing" || shook) {
        frame = requestAnimationFrame(loop);
        return;
      }
      if (status === "won") {
        hapticVictory();
        playVictoryJingle();
      } else if (!terminalHit) {
        hapticImpact();
        playHitSound();
      }
      setMenuOpen(true);
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
    unlockGameAudio();
    setMenuOpen(false);
    setError("");
    setResult(null);
    setPending(null);
    setSnapshot(null);
    setRun(null);
    held.current.clear();
    justPressed.current.clear();
    setPhase("starting");
    try {
      const next: Run = demo
        ? { id: "demo", seed: 1 + Math.floor(Math.random() * 2147483646), game: selected, difficulty, engineVersion: selected === "ORBITA_PIXEL" ? orbitVersion : gameVersion }
        : await startRun(selected, difficulty);
      setRun(next);
      setPhase("playing");
    } catch (failure) {
      setPhase("idle");
      setError(failure instanceof Error ? failure.message : "Não foi possível iniciar.");
      setMenuOpen(true);
    }
  }, [controlsLocked, demo, selected, difficulty]);

  function select(code: GameCode, button: HTMLButtonElement) {
    opener.current = button;
    dialog.current?.showModal();
    setOpened(true);
    setMenuOpen(false);
    setSelected(code);
    setBooting(true);
    playBootChime();
    setRun(null);
    setSnapshot(null);
    setResult(null);
    setError("");
    setPhase("idle");
  }

  function closeGame() {
    if (phase === "starting" || sending) return;
    if ((playing || pending) && !window.confirm("Voltar aos cartuchos e descartar esta partida?")) return;
    dialog.current?.close();
    setOpened(false);
    setMenuOpen(false);
    setRun(null);
    setPending(null);
    setPhase("idle");
    setBooting(false);
    setSnapshot(null);
    setResult(null);
    setError("");
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
    if (!visible || !opened) return;
    function menuKeys(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat) return;
      if (event.key === "Shift" && !controlsLocked) {
        event.preventDefault();
        cycleDifficulty();
      }
      if (event.key === "Enter" && !controlsLocked && !(event.target instanceof HTMLButtonElement)) {
        event.preventDefault();
        void start();
      }
    }
    window.addEventListener("keydown", menuKeys);
    return () => window.removeEventListener("keydown", menuKeys);
  }, [visible, opened, controlsLocked, cycleDifficulty, start]);
  return (
    <section className="arcade-games" aria-labelledby="arcade-title">
      <h2 id="arcade-title">Fliperama</h2>
      <div className="arcade-cartridges" role="group" aria-label="Escolha um cartucho">
        {cartridges.map(({ code, title, icon: Icon, accent }) => (
          <button key={code} type="button" data-accent={accent} aria-haspopup="dialog"
            disabled={controlsLocked} onClick={(event) => select(code, event.currentTarget)}>
            <Icon size={20} aria-hidden="true" /> {title}
          </button>
        ))}
      </div>
      {demo ? <p className="muted">Demonstração com recordes nesta sessão.</p>
        : <p className="muted">{credited === null ? "Até três partidas com pontos por dia." : `${credited}/3 partidas creditadas hoje, no horário de Brasília.`}</p>}
      {statsError && <p className="error">Os recordes salvos estão indisponíveis no momento.</p>}

      <div ref={sprite} hidden><AvatarRenderer skinId={avatar} cosmetics={cosmetics} /></div>
      <dialog ref={dialog} className="arcade-fullscreen" aria-labelledby="arcade-game-title"
        onCancel={(event) => { event.preventDefault(); if (menuOpen) setMenuOpen(false); else closeGame(); }}
        onClose={() => opener.current?.focus()}>
        <h2 id="arcade-game-title" className="sr-only">{cartridge.title}</h2>
        <GameBoyFrame playing={playing} action={cartridge.action} directionsMode={cartridge.directions} onInput={onInput} onStart={() => void start()} onSelect={cycleDifficulty}
          startDisabled={controlsLocked} selectDisabled={controlsLocked} onExit={closeGame}
          exitDisabled={phase === "starting" || sending} onMenu={() => setMenuOpen((open) => !open)} menuOpen={menuOpen}>
            <div className="arcade-scoreboard">
              <span>PLACAR <strong>{points}</strong></span>
              <span>RECORDE <strong>{best[recordCode] ?? 0}</strong></span>
              <span>TEMPO <strong>{remaining}s</strong></span>
            </div>
            <div className="arcade-lcd-viewport"><div className="arcade-display">
              <canvas ref={canvas} width={canvasWidth} height={canvasHeight} role="img"
                aria-label={`Tela de ${cartridge.title}`} />
              {booting ? <div className="arcade-boot" role="status"><strong>PIXEL BARBER</strong></div> :
                !run && <div className="arcade-title-screen">
                  <Gamepad2 size={28} aria-hidden="true" />
                  <strong>{cartridge.title}</strong>
                  <span className="arcade-lcd-level">{levels[difficulty].subtitle} · {String(multipliers[difficulty]).replace(".", ",")}×</span>
                </div>}
            </div></div>
        </GameBoyFrame>
        {menuOpen && (
          <section className="arcade-game-details" aria-label="Opções e resultado">
            <button type="button" className="secondary arcade-close-options" onClick={() => setMenuOpen(false)}>Fechar opções</button>
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
            <p className="muted">{cartridge.instructions}</p>
            <p className="muted arcade-keys">Teclado: setas para dirigir, X ou Espaço para a ação, Enter para iniciar e Shift para mudar a dificuldade.</p>
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
        )}
      </dialog>
    </section>
  );
}
