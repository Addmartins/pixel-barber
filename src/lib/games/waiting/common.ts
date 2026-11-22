import { canvasHeight, canvasWidth, type Game, type GameState } from "../types";

export type Vector = { x: number; y: number };
export type Ball = Vector & { vx: number; vy: number };
export type WaitingState = GameState & { label: string; message: string; cue: "shot" | "score" | "hit" | null };

export function waitingState(label: string): WaitingState {
  return { label, message: "", cue: null, score: 0, ticks: 0, status: "playing" };
}

export function encodeShot(x: number, y: number) {
  const limit = Math.min(1, 100 / Math.hypot(x, y));
  const dx = Math.round(x * limit);
  const dy = Math.round(y * limit);
  return Math.hypot(dx, dy) >= 5 ? (dx + 100) | ((dy + 100) << 8) : 0;
}

export function decodeShot(input: number): Vector {
  return { x: ((input & 255) - 100) / 100, y: ((input >> 8) - 100) / 100 };
}

export function launch(ball: Ball, input: number, speed: number) {
  const shot = decodeShot(input);
  ball.vx = shot.x * speed;
  ball.vy = shot.y * speed;
}

export function moving(ball: Ball) { return ball.vx !== 0 || ball.vy !== 0; }
export function distance(a: Vector, b: Vector) { return Math.hypot(a.x - b.x, a.y - b.y); }
export function ballAt(x: number, y: number): Ball { return { x, y, vx: 0, vy: 0 }; }

export function slow(ball: Ball, friction: number) {
  ball.vx *= friction;
  ball.vy *= friction;
  if (Math.hypot(ball.vx, ball.vy) < .055) ball.vx = ball.vy = 0;
}

export function box(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

export function pixelBall(ctx: CanvasRenderingContext2D, ball: Vector, color: string, radius: number) {
  box(ctx, "#192634", ball.x - radius - 1, ball.y - radius + 1, 2 * radius + 2, 2 * radius);
  box(ctx, color, ball.x - radius, ball.y - radius, 2 * radius, 2 * radius);
  box(ctx, "#fff7dc", ball.x - radius + 1, ball.y - radius + 1, 2, 2);
}

export function field(ctx: CanvasRenderingContext2D, dark: string, light: string) {
  box(ctx, dark, 0, 0, canvasWidth, canvasHeight);
  for (let y = 0; y < canvasHeight; y += 32) box(ctx, light, 0, y, canvasWidth, 16);
}

// Each game keeps its own concrete state behind the same fixed-tick interface.
export function createWaitingRun<S extends WaitingState>(game: Game<S>, seed: number) {
  const state = game.create(seed, "EASY");
  return {
    state,
    step(input: number) {
      state.cue = null;
      if (state.status === "playing") game.step(state, input);
    },
    draw(ctx: CanvasRenderingContext2D) { game.draw(ctx, state); },
  };
}

export type WaitingRun = ReturnType<typeof createWaitingRun>;
