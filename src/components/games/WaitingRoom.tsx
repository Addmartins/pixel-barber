"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { landscapeForArcade } from "@/lib/device/arcade-orientation";
import { playHitSound, playJumpSound, playScoreSound, unlockGameAudio } from "@/lib/games/audio";
import { canvasHeight, canvasWidth, ticksPerSecond } from "@/lib/games/types";
import { waitingGames, type WaitingGame } from "@/lib/games/waiting";
import { box, decodeShot, encodeShot, type Vector } from "@/lib/games/waiting/common";
import styles from "./waiting-room.module.css";

const tickMs = 1000 / ticksPerSecond;
const previewSeed = 42;

function GamePreview({ game }: { game: WaitingGame }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const context = canvas.current?.getContext("2d");
    if (context) game.create(previewSeed).draw(context);
  }, [game]);
  return <canvas ref={canvas} width={canvasWidth} height={canvasHeight} className={styles.thumbnail} aria-hidden="true" />;
}

function GameBoard({ game }: { game: WaitingGame }) {
  const [run] = useState(() => game.create(crypto.getRandomValues(new Uint32Array(1))[0]));
  const [label, setLabel] = useState(run.state.label);
  const [message, setMessage] = useState("");
  const [finished, setFinished] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ pointer: number; anchor: Vector; input: number } | null>(null);
  const queuedInput = useRef(0);

  useEffect(() => {
    const context = canvas.current?.getContext("2d");
    if (!context) {
      setMessage("O navegador não disponibilizou o Canvas 2D.");
      return;
    }
    const ctx = context;
    const sound = new AbortController();
    let previous: number | undefined;
    let elapsed = 0;
    let frame = 0;

    function resetTiming() {
      previous = undefined;
      elapsed = 0;
      drag.current = null;
      queuedInput.current = 0;
    }

    function paint() {
      run.draw(ctx);
      const origin = run.aim();
      const input = drag.current?.input;
      if (!origin || !input) return;
      const aim = decodeShot(input);
      const length = game.id === "penalties" ? 75 : 58;
      for (let i = .16; i <= 1; i += .16) {
        box(ctx, "#fff0b7", origin.x + aim.x * length * i, origin.y + aim.y * length * i, 2, 2);
      }
    }

    function loop(now: number) {
      if (!document.hidden) {
        elapsed += previous === undefined ? 0 : Math.min(100, now - previous);
        previous = now;
        while (elapsed >= tickMs && run.state.status === "playing") {
          elapsed -= tickMs;
          run.step(queuedInput.current);
          queuedInput.current = 0;
          if (run.state.cue === "shot") playJumpSound(sound.signal);
          if (run.state.cue === "score") playScoreSound(sound.signal);
          if (run.state.cue === "hit") playHitSound(sound.signal);
        }
        paint();
        setLabel(run.state.label);
        setMessage(run.state.message);
        if (run.state.status !== "playing") {
          setFinished(true);
          return;
        }
      }
      frame = requestAnimationFrame(loop);
    }

    paint();
    document.addEventListener("visibilitychange", resetTiming);
    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      sound.abort();
      resetTiming();
      document.removeEventListener("visibilitychange", resetTiming);
    };
  }, [game, run]);

  function position(event: PointerEvent<HTMLCanvasElement>): Vector {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * canvasWidth / rect.width,
      y: (event.clientY - rect.top) * canvasHeight / rect.height,
    };
  }

  function aim(event: PointerEvent<HTMLCanvasElement>, anchor: Vector) {
    const point = position(event);
    const x = (point.x - anchor.x) * game.direction;
    const y = (point.y - anchor.y) * game.direction;
    if (game.id === "penalties" && y >= 0) return 0;
    return encodeShot(x * 2.5, y * 2.5);
  }

  function finishDrag(event: PointerEvent<HTMLCanvasElement>) {
    const gesture = drag.current;
    if (gesture?.pointer !== event.pointerId) return;
    drag.current = null;
    if (run.state.status === "playing" && run.aim()) queuedInput.current = aim(event, gesture.anchor);
  }

  return (
    <div className={styles.board}>
      <p className={styles.score} role="status">{label}</p>
      <canvas ref={canvas} width={canvasWidth} height={canvasHeight} className={styles.canvas}
        aria-label={`Área de jogo de ${game.title}`}
        onPointerDown={event => {
          if (event.button !== 0 || drag.current || queuedInput.current || run.state.status !== "playing" || !run.aim()) return;
          unlockGameAudio();
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { pointer: event.pointerId, anchor: position(event), input: 0 };
        }}
        onPointerMove={event => {
          const gesture = drag.current;
          if (gesture?.pointer === event.pointerId) gesture.input = aim(event, gesture.anchor);
        }}
        onPointerUp={finishDrag}
        onLostPointerCapture={event => { if (drag.current?.pointer === event.pointerId) drag.current = null; }}
        onPointerCancel={event => { if (drag.current?.pointer === event.pointerId) drag.current = null; }} />
      <p className={styles.feedback} role="status">{message || (finished ? "Partida concluída." : "")}</p>
    </div>
  );
}

function WaitingGameDialog({ game, onExit }: { game: WaitingGame; onExit: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const backButton = useRef<HTMLButtonElement>(null);
  const [round, setRound] = useState(0);

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  useEffect(() => {
    const button = backButton.current;
    if (!button) return;
    function finishTouch(event: TouchEvent) {
      const touch = event.changedTouches[0];
      if (!event.cancelable || !touch || !button?.contains(document.elementFromPoint(touch.clientX, touch.clientY))) return;
      // Cancel the synthetic click so it cannot reach a card as the dialog closes.
      event.preventDefault();
      onExit();
    }
    button.addEventListener("touchend", finishTouch, { passive: false });
    return () => button.removeEventListener("touchend", finishTouch);
  }, [onExit]);

  return (
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="waiting-game-title"
      onCancel={event => { event.preventDefault(); onExit(); }}>
      <div className={styles.playArea}>
        <header className={styles.gameHeader}>
          <h3 id="waiting-game-title">{game.title}</h3>
          <p>{game.instructions}</p>
        </header>
        <GameBoard key={round} game={game} />
        <div className={styles.actions}>
          <button ref={backButton} type="button" className="secondary" onClick={onExit}>Voltar à Sala de Espera</button>
          <button type="button" className="primary" onClick={() => setRound(value => value + 1)}>Reiniciar partida</button>
        </div>
      </div>
    </dialog>
  );
}

export function WaitingRoom({ visible }: { visible: boolean }) {
  const [game, setGame] = useState<WaitingGame>();
  const opener = useRef<HTMLButtonElement | null>(null);
  const releaseOrientation = useRef<(() => Promise<void>) | null>(null);

  const restoreOrientation = useCallback(() => {
    const release = releaseOrientation.current;
    releaseOrientation.current = null;
    void release?.();
  }, []);

  useEffect(() => restoreOrientation, [restoreOrientation]);

  const closeGame = useCallback(() => {
    restoreOrientation();
    setGame(undefined);
  }, [restoreOrientation]);

  useEffect(() => {
    if (!visible) closeGame();
  }, [visible, closeGame]);

  useEffect(() => {
    if (visible && !game) opener.current?.focus();
  }, [visible, game]);

  return (
    <div className={styles.room}>
      <header>
        <h2 id="arcade-title">Sala de Espera</h2>
        <p className="muted">Partidas individuais com placar local.</p>
      </header>
      <ul className={styles.games}>
        {waitingGames.map(item => (
          <li key={item.id} className={styles.card}>
            <GamePreview game={item} />
            <h3>{item.title}</h3>
            <p>{item.description}</p>
            <button type="button" className="primary" aria-haspopup="dialog" aria-label={`Jogar ${item.title}`}
              onClick={event => {
                opener.current = event.currentTarget;
                releaseOrientation.current ??= landscapeForArcade();
                setGame(item);
              }}>
              Jogar
            </button>
          </li>
        ))}
      </ul>
      {game && visible && <WaitingGameDialog game={game} onExit={closeGame} />}
    </div>
  );
}
