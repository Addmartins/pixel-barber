"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { Check, Gamepad2, Rocket, Scissors, Timer, TrendingUp } from "lucide-react";
import { AvatarRenderer } from "@/components/avatar/AvatarRenderer";
import type { AvatarId } from "@/lib/avatars";
import type { EquippedCosmetic } from "@/lib/store";
import { landscapeForArcade } from "@/lib/device/arcade-orientation";
import { hapticImpact, hapticVictory } from "@/lib/device/haptics";
import { playHitSound, playJumpSound, playScoreSound, playVictoryJingle, unlockGameAudio } from "@/lib/games/audio";
import { boardWidth, boardHeight, cellInputShift } from "@/lib/games/salon-match";
import { createGame } from "@/lib/games";
import { finishRun, getArcadeStats, startRun } from "@/lib/games/client";
import {
  A, canvasHeight, canvasWidth, difficulties, DOWN, gameVersion, LEFT, multipliers, orbitVersion, RIGHT, roundSeconds, ticksPerSecond, UP,
  isGameCode, type ArcadeHistoryEntry, type Difficulty, type GameCode, type GameResult, type GameState, type InputChange, type Run,
} from "@/lib/games/types";
import { ArcadeHistory } from "./ArcadeHistory";
import { WaitingRoom } from "./WaitingRoom";
import { GameBoyFrame } from "./GameBoyFrame";
import { SummitArt, WhiskerArt, SproutArt } from "./RetroCartArt";
import "./arcade.css";

const cartridges = [
  { code: "NAVALHA_RUSH", station: "Bancada de corte", goal: 80, mission: "Desative os robôs da oficina.", title: "Bombas de Espuma", icon: Scissors, accent: "mint", action: "Bomba", directions: "all",
    instructions: "Plante uma bomba, vire a esquina e fuja da explosão em cruz. Quebre caixas para abrir passagem até os robôs." },
  { code: "ESCALADA_KONG", station: "Estante de pomadas", goal: 30, mission: "Atravesse os aros da estante.", title: "Salto de Pomada", icon: SummitArt, accent: "amber", action: "Impulso", directions: "horizontal",
    instructions: "Guie o ricochete com esquerda e direita. Segure Impulso para saltar mais alto ao chegar perto do chão. Passe pelos quatro aros, evite os espinhos e atravesse o portão." },
  { code: "ORBITA_PIXEL", station: "Estação de limpeza", goal: 30, mission: "Pilote a cápsula e limpe o corredor.", title: "Órbita Pixel", icon: Rocket, accent: "sky", action: "Laser", directions: "all",
    instructions: "Pilote entre os invasores. Segure Laser para disparar. Cápsulas verdes dão 5 segundos de tiro triplo. Derrote os dois mestres. O recorde é compartilhado com Bombas de Espuma." },
  { code: "BARBA_FIGHTER", station: "Depósito", goal: 150, mission: "Recolha as fichas da navalha no labirinto.", title: "Ruínas da Navalha", icon: TrendingUp, accent: "rose", action: undefined, directions: "all",
    instructions: "Toque para andar uma casa ou segure para continuar. Recolha as fichas e desvie dos sentinelas. Pegue uma loção dourada para inverter a perseguição por alguns segundos." },
  { code: "BARBER_VALLEY", station: "Organização do balcão", goal: 24, mission: "Reúna pelo menos três itens em uma troca.", title: "Itens do Salão", icon: SproutArt, accent: "lime", action: "Selecionar", directions: "all",
    instructions: "Toque em um item e depois em um vizinho. A troca só acontece se formar três ou mais itens iguais em linha. As combinações douram as casas. No teclado, use as setas e Selecionar." },
  { code: "TORRE_FADE", station: "Vitrine", goal: 45, mission: "Empilhe os expositores sem perder a base.", title: "Torre de Neon", icon: Timer, accent: "gold", action: "Soltar", directions: "none",
    instructions: "Observe o cabo e solte o bloco quando ele se alinhar à torre. Encaixes precisos rendem mais pontos e preservam a largura." },
  { code: "BIGODE_SNAKE", station: "Prateleira de óleos", goal: 30, mission: "Alimente a cobrinha com três óleos.", title: "Bigode Snake", icon: WhiskerArt, accent: "lime", action: undefined, directions: "all",
    instructions: "Guie a cobrinha com o direcional. Pegue óleos e loções douradas sem tocar na cauda, nas bordas ou nas navalhas." },
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

export function Arcade({ demo, visible, onBalance, avatar, cosmetics, clientId }: {
  demo: boolean;
  clientId?: string;
  visible: boolean;
  avatar: AvatarId;
  cosmetics: EquippedCosmetic[];
  onBalance: (balance: number) => void;
}) {
  const [demoHistory, setDemoHistory] = useState<ArcadeHistoryEntry[]>([]);
  const [roomOpen, setRoomOpen] = useState(false);
  const [completed, setCompleted] = useState<GameCode[]>([]);
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
  const releaseOrientation = useRef<(() => Promise<void>) | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const paused = useRef(false);
  const sprite = useRef<HTMLDivElement>(null);
  const taps = useRef<number[]>([]);
  const boardTouch = useRef<{ pointer: number; cell: number } | null>(null);
  const held = useRef(new Map<number | string, number>());
  const justPressed = useRef(new Map<number | string, number>());
  const cartridge = cartridges.find(({ code }) => code === selected) ?? cartridges[0];
  const nextStation = cartridges.find(({ code }) => !completed.includes(code));
  const storageKey = clientId ? "pixel-barber:adventure:" + clientId : undefined;
  const playing = phase === "playing";
  const controlsLocked = playing || phase === "starting" || sending || Boolean(pending) || booting;
  const activeDifficulty = run?.difficulty ?? difficulty;
  const recordCode = !demo && selected === "ORBITA_PIXEL" ? "NAVALHA_RUSH" : selected;
  const points = result?.score ?? Math.round((snapshot?.score ?? 0) * multipliers[activeDifficulty]);
  const remaining = Math.max(0, roundSeconds(selected, activeDifficulty) - Math.floor((snapshot?.ticks ?? 0) / ticksPerSecond));

  const restoreOrientation = useCallback(() => {
    const release = releaseOrientation.current;
    releaseOrientation.current = null;
    void release?.();
  }, []);

  useEffect(() => restoreOrientation, [restoreOrientation]);

  useEffect(() => {
    if (!storageKey) return;
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
      if (Array.isArray(saved)) setCompleted([...new Set(saved.filter(isGameCode))]);
    } catch { /* The adventure still works within the current session. */ }
  }, [storageKey]);

  const completeMission = useCallback((game: GameCode, score: number) => {
    const station = cartridges.find(({ code }) => code === game);
    if (!station || score < station.goal) return;
    setCompleted(previous => previous.includes(game) ? previous : [...previous, game]);
  }, []);

  useEffect(() => {
    if (!storageKey || !completed.length) return;
    try { localStorage.setItem(storageKey, JSON.stringify(completed)); } catch { /* Optional device storage. */ }
  }, [storageKey, completed]);

  useEffect(() => {
    paused.current = menuOpen;
    if (menuOpen) {
      held.current.clear();
      justPressed.current.clear();
      taps.current.length = 0;
      boardTouch.current = null;
    }
  }, [menuOpen]);

  useEffect(() => {
    if (!booting) return;
    const timer = window.setTimeout(() => setBooting(false), 1500);
    return () => window.clearTimeout(timer);
  }, [booting]);

  const onInput = useCallback((key: number | string, bit: number) => {
    if (paused.current) return;
    if (bit) {
      if (held.current.get(key) !== bit) justPressed.current.set(key, bit);
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
      if (!bit || event.defaultPrevented || event.repeat) return;
      event.preventDefault();
      onInput(event.code, bit);
    }
    function keyup(event: KeyboardEvent) { onInput(event.code, 0); }
    function reset() { held.current.clear(); justPressed.current.clear(); taps.current.length = 0; boardTouch.current = null; }
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
    if (avatarArt && (run.game === "NAVALHA_RUSH" || run.game === "BARBA_FIGHTER")) {
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
      if (paused.current) {
        previousTime = time;
        accumulator = 0;
        frame = requestAnimationFrame(loop);
        return;
      }
      accumulator += Math.min(100, time - previousTime);
      previousTime = time;
      while (accumulator >= tickMs && engine.state.status === "playing") {
        let mask = 0;
        for (const bit of justPressed.current.values()) mask |= bit;
        justPressed.current.clear();
        for (const bit of held.current.values()) mask |= bit;
        // A blank tick between touch selections keeps repeated cells distinct in replay.
        if (!(previousMask >> cellInputShift) && taps.current.length) mask |= taps.current.shift()!;
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
      completeMission(run!.game, score);
      setMenuOpen(true);
      setPhase("finished");
      if (demo) {
        const displayScore = Math.round(score * multipliers[run!.difficulty]);
        const entry: ArcadeHistoryEntry = {
          id: run!.id, game_code: run!.game, difficulty: run!.difficulty, display_score: displayScore,
          won: status === "won", points_awarded: 0, duration_seconds: Math.ceil(ticks / ticksPerSecond),
          created_at: new Date().toISOString(),
        };
        setBest((previous) => ({ ...previous, [run!.game]: Math.max(previous[run!.game] ?? 0, displayScore) }));
        setDemoHistory((previous) => [entry, ...previous].slice(0, 50));
      } else {
        const finished = { run: run!, snapshot: { score, status, ticks }, changes };
        setPending(finished);
        void save(finished);
      }
    }
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [run, demo, save, completeMission]);

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
    taps.current.length = 0;
    setPhase("starting");
    try {
      const next: Run = demo
        ? { id: crypto.randomUUID(), seed: 1 + Math.floor(Math.random() * 2147483646), game: selected, difficulty, engineVersion: selected === "ORBITA_PIXEL" ? orbitVersion : gameVersion }
        : await startRun(selected, difficulty);
      setRun(next);
      setPhase("playing");
    } catch (failure) {
      setPhase("idle");
      setError(failure instanceof Error ? failure.message : "Não foi possível iniciar.");
      setMenuOpen(true);
    }
  }, [controlsLocked, demo, selected, difficulty]);

  function boardCell(event: PointerEvent<HTMLCanvasElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const column = Math.floor(((event.clientX - bounds.left) * canvasWidth / bounds.width - 13) / 18);
    const row = Math.floor(((event.clientY - bounds.top) * canvasHeight / bounds.height - 22) / 18);
    return column >= 0 && column < boardWidth && row >= 0 && row < boardHeight ? row * boardWidth + column : -1;
  }

  function select(code: GameCode, button: HTMLButtonElement) {
    opener.current = button;
    releaseOrientation.current ??= landscapeForArcade();
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
      <div className="mode-switch arcade-sections" role="group" aria-label="Seções do Pixel Boy">
        <button type="button" aria-pressed={!roomOpen} onClick={() => setRoomOpen(false)}>Cartuchos</button>
        <button type="button" aria-pressed={roomOpen} onClick={() => setRoomOpen(true)}>Sala de Espera</button>
      </div>
      <ArcadeHistory demo={demo} demoEntries={demoHistory} games={cartridges} levels={levels} />
      {roomOpen ? <WaitingRoom visible={visible} /> : <>
      <header className="arcade-adventure">
        <div className="arcade-adventure-avatar"><AvatarRenderer skinId={avatar} cosmetics={cosmetics} size={36} /></div>
        <div className="arcade-adventure-copy">
          <h2 id="arcade-title">Aventura na barbearia</h2>
          <p>{nextStation ? "Prepare o salão para a abertura. Escolha uma estação e cumpra a missão." : "Salão pronto para abrir. Volte às estações para melhorar seu placar."}</p>
          <label className="arcade-progress">
            <span>{completed.length} de {cartridges.length} estações prontas</span>
            <progress value={completed.length} max={cartridges.length} />
          </label>
        </div>
      </header>
      <div className="arcade-cartridges" role="group" aria-label="Estações da barbearia">
        {cartridges.map(({ code, title, station, icon: Icon, accent }) => (
          <button key={code} type="button" data-accent={accent} data-next={nextStation?.code === code}
            aria-haspopup="dialog" disabled={controlsLocked} onClick={(event) => select(code, event.currentTarget)}>
            <span className="arcade-station-icon"><Icon size={21} aria-hidden="true" /></span>
            <span className="arcade-station-copy"><span>{station}</span><strong>{title}</strong></span>
            {completed.includes(code) && <span className="arcade-station-done" aria-label="Missão concluída"><Check size={19} aria-hidden="true" /></span>}
          </button>
        ))}
      </div>
      {demo ? <p className="muted">Demonstração com recordes nesta sessão.</p>
        : <p className="muted">{credited === null ? "Até três partidas com crédito por dia, com teto de 20 pts por partida." : `${credited}/3 partidas creditadas hoje, no horário de Brasília.`}</p>}
      {statsError && <p className="error">Os recordes salvos estão indisponíveis no momento.</p>}

      <div ref={sprite} hidden><AvatarRenderer skinId={avatar} cosmetics={cosmetics} /></div>
      <dialog ref={dialog} className="arcade-fullscreen" aria-labelledby="arcade-game-title"
        onCancel={(event) => { event.preventDefault(); if (menuOpen) setMenuOpen(false); else closeGame(); }}
        onClose={() => { restoreOrientation(); opener.current?.focus(); }}>
        <h2 id="arcade-game-title" className="sr-only">{cartridge.title}</h2>
        <GameBoyFrame playing={playing && !menuOpen} directionPriority={selected === "ESCALADA_KONG"} action={cartridge.action} directionsMode={cartridge.directions} onInput={onInput} onStart={() => void start()} onSelect={cycleDifficulty}
          startDisabled={controlsLocked} selectDisabled={controlsLocked} onExit={closeGame}
          exitDisabled={phase === "starting" || sending} onMenu={() => setMenuOpen((open) => !open)} menuOpen={menuOpen}>
            <div className="arcade-scoreboard">
              <span>PLACAR <strong>{points}</strong></span>
              <span>MISSÃO <strong>{Math.min(snapshot?.score ?? 0, cartridge.goal)}/{cartridge.goal}</strong></span>
              <span>TEMPO <strong>{remaining}s</strong></span>
            </div>
            <div className="arcade-lcd-viewport"><div className="arcade-display">
              <canvas ref={canvas} width={canvasWidth} height={canvasHeight} role="img"
                data-interactive={selected === "BARBER_VALLEY"}
                aria-label={`Tela de ${cartridge.title}`}
                onPointerDown={(event) => {
                  if (!playing || menuOpen || selected !== "BARBER_VALLEY" || boardTouch.current || event.button !== 0) return;
                  const cell = boardCell(event);
                  if (cell < 0) return;
                  boardTouch.current = { pointer: event.pointerId, cell };
                  event.currentTarget.setPointerCapture(event.pointerId);
                }}
                onPointerUp={(event) => {
                  const press = boardTouch.current;
                  if (press?.pointer !== event.pointerId) return;
                  boardTouch.current = null;
                  if (!menuOpen && press.cell === boardCell(event) && taps.current.length < 2) {
                    taps.current.push((press.cell + 1) << cellInputShift);
                  }
                }}
                onLostPointerCapture={() => { boardTouch.current = null; }}
                onPointerCancel={() => { boardTouch.current = null; }} />
              {booting ? <div className="arcade-boot" role="status"><strong>PIXEL BARBER</strong></div> :
                !run && <div className="arcade-title-screen">
                  <Gamepad2 size={28} aria-hidden="true" />
                  <strong>{cartridge.title}</strong>
                  <span className="arcade-lcd-level">{levels[difficulty].subtitle} · {String(multipliers[difficulty]).replace(".", ",")}×</span>
                  <p className="arcade-title-instructions">{cartridge.mission} {cartridge.instructions}</p>
                </div>}
            </div></div>
        </GameBoyFrame>
        {menuOpen && (
          <section className="arcade-game-details" aria-label="Opções e resultado">
            <button type="button" className="secondary arcade-close-options" onClick={() => setMenuOpen(false)}>{playing ? "Continuar partida" : "Fechar opções"}</button>
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
            <p className="muted">{demo ? "Recorde" : "Recorde histórico"} {best[recordCode] ?? 0}</p>
            <p className="muted arcade-keys">Teclado: setas para dirigir, X ou Espaço para a ação, Enter para iniciar e Shift para mudar a dificuldade.</p>
            {phase === "finished" && snapshot && <p role="status" className="arcade-result">
              {snapshot.status === "won" ? "Você venceu!" : "Fim de jogo."} {points} pontos de placar.
              {result && (result.points_awarded > 0 ? ` +${result.points_awarded} pontos no seu saldo.` :
                result.score > 0 ? " Limite diário atingido. A partida contou para o recorde." : " Nenhum ponto creditado.")}
            </p>}
            {phase === "finished" && snapshot && <p role="status" className="arcade-mission-result">
              {snapshot.score >= cartridge.goal ? "Missão concluída · " + cartridge.station : "Meta da missão " + snapshot.score + "/" + cartridge.goal}
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
      </>}
    </section>
  );
}
