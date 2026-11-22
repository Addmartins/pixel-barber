import { nextSeed } from "../random";
import type { Game } from "../types";
import { ballAt, box, distance, launch, moving, pixelBall, slow, waitingState, type Ball, type WaitingState } from "./common";

const radius = 5;
const table = { left: 20, right: 220, top: 22, bottom: 138 };
const pockets = [20, 120, 220].flatMap(x => [22, 138].map(y => ({ x, y })));
const colors = ["#ffc65b", "#7eb8fb", "#f27469", "#b6a0ef", "#e9a55a", "#7ddeaa"];
type PoolBall = Ball & { color: string; pocketed: boolean };
type Pool = WaitingState & { balls: PoolBall[]; strokes: number; rolling: boolean };

function rack(seed: number) {
  const order = [...colors];
  for (let index = order.length - 1; index > 0; index--) {
    seed = nextSeed(seed);
    const target = seed % (index + 1);
    [order[index], order[target]] = [order[target], order[index]];
  }
  const positions = [[59, 80], [151, 80], [161, 74], [161, 86], [171, 68], [171, 80], [171, 92]];
  return positions.map(([x, y], index): PoolBall => ({
    ...ballAt(x, y), color: index === 0 ? "#f7e9cb" : order[index - 1], pocketed: false,
  }));
}

function collide(a: PoolBall, b: PoolBall) {
  const gap = distance(a, b);
  if (gap >= radius * 2) return;
  const dx = gap ? (b.x - a.x) / gap : 1;
  const dy = gap ? (b.y - a.y) / gap : 0;
  const correction = (2 * radius - gap) / 2;
  a.x -= dx * correction; a.y -= dy * correction;
  b.x += dx * correction; b.y += dy * correction;
  const closing = (a.vx - b.vx) * dx + (a.vy - b.vy) * dy;
  if (closing <= 0) return;
  a.vx -= closing * dx; a.vy -= closing * dy;
  b.vx += closing * dx; b.vy += closing * dy;
}

function rails(ball: PoolBall) {
  const { left, right, top, bottom } = table;
  if (ball.x < left + radius || ball.x > right - radius) {
    ball.x = Math.max(left + radius, Math.min(right - radius, ball.x));
    ball.vx *= -.84;
  }
  if (ball.y < top + radius || ball.y > bottom - radius) {
    ball.y = Math.max(top + radius, Math.min(bottom - radius, ball.y));
    ball.vy *= -.84;
  }
}

function updateLabel(state: Pool) { state.label = `${state.score}/6 bolas · ${state.strokes} tacadas`; }

export const pool: Game<Pool> = {
  create: seed => ({ ...waitingState("0/6 bolas · 0 tacadas"), balls: rack(seed), strokes: 0, rolling: false }),
  step(state, input) {
    state.ticks++;
    const [cue, ...objects] = state.balls;
    if (!state.rolling) {
      if (!input) return;
      launch(cue, input, 6.5);
      state.rolling = true;
      state.strokes++;
      state.cue = "shot";
      state.message = "";
      updateLabel(state);
    }
    const active = state.balls.filter(ball => !ball.pocketed);
    for (const ball of active) {
      ball.x += ball.vx; ball.y += ball.vy;
      if (pockets.some(pocket => distance(pocket, ball) <= 11)) {
        ball.pocketed = true;
        ball.vx = ball.vy = 0;
        if (ball === cue) {
          state.strokes++;
          state.message = "Bola branca na caçapa · +1 tacada";
          state.cue = "hit";
        } else {
          state.score++;
          state.cue = "score";
        }
        updateLabel(state);
      }
    }
    const remaining = active.filter(ball => !ball.pocketed);
    remaining.forEach((a, index) => {
      for (let i = index + 1; i < remaining.length; i++) collide(a, remaining[i]);
    });
    for (const ball of remaining) {
      rails(ball);
      slow(ball, .975);
    }
    if (remaining.some(moving)) return;
    state.rolling = false;
    if (state.score === 6) {
      state.status = "won";
      return;
    }
    if (cue.pocketed) {
      const spots = [59, 73, 87, 101, 115, 129, 143, 157, 171, 185];
      const x = spots.find(x => objects.every(ball => ball.pocketed || distance(ball, { x, y: 80 }) > 2 * radius)) ?? 59;
      Object.assign(cue, ballAt(x, 80), { pocketed: false });
    }
  },
  draw(ctx, state) {
    box(ctx, "#191d32", 0, 0, 240, 160);
    box(ctx, "#7a463e", 8, 10, 224, 140);
    box(ctx, "#b97154", 13, 15, 214, 130);
    box(ctx, "#235751", 18, 20, 204, 120);
    box(ctx, "#30836b", 23, 25, 194, 110);
    box(ctx, "#357f67", 118, 25, 2, 110);
    for (const pocket of pockets) {
      box(ctx, "#151d28", pocket.x - 8, pocket.y - 5, 16, 10);
      box(ctx, "#151d28", pocket.x - 5, pocket.y - 8, 10, 16);
    }
    for (const ball of state.balls) if (!ball.pocketed) pixelBall(ctx, ball, ball.color, radius);
  },
};
