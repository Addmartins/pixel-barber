import { nextSeed } from "../random";
import type { Game } from "../types";
import { box, decodeShot, field, pixelBall, waitingState, type WaitingState } from "./common";

const attempts = 5;
const spot = { x: 120, y: 132 };
const goal = { left: 54, right: 186, line: 46 };
type Shot = { x: number; strength: number; duration: number; elapsed: number };
type Penalties = WaitingState & {
  seed: number; kicks: number; keeper: number; target: number; shot: Shot | null; pause: number;
};

export const penalties: Game<Penalties> = {
  create: seed => ({
    ...waitingState("Cobrança 1/5 · 0 gols"),
    seed, kicks: 0, keeper: 120, target: 120, shot: null, pause: 0,
  }),
  step(state, input) {
    state.ticks++;
    if (state.pause) {
      if (--state.pause) return;
      state.shot = null;
      if (state.kicks === attempts) {
        state.status = "won";
        state.label = `Resultado · ${state.score}/5 gols`;
      } else {
        state.label = `Cobrança ${state.kicks + 1}/5 · ${state.score} gols`;
        state.keeper = 120;
      }
      return;
    }
    if (state.shot) {
      state.keeper += Math.max(-2.5, Math.min(2.5, state.target - state.keeper));
      if (++state.shot.elapsed < state.shot.duration) return;
      const { x, strength } = state.shot;
      const outside = x < goal.left + 3 || x > goal.right - 3;
      const saved = strength < .13 || Math.abs(x - state.keeper) < 16;
      if (!outside && !saved) state.score++;
      state.kicks++;
      state.label = `${state.kicks}/5 cobranças · ${state.score} gols`;
      state.message = outside ? "Para fora!" : saved ? "Defesa do goleiro!" : "Gol!";
      state.cue = outside || saved ? "hit" : "score";
      state.pause = 42;
      return;
    }
    if (!input) return;
    const shot = decodeShot(input);
    const strength = Math.min(1, Math.hypot(shot.x, shot.y));
    const x = spot.x + (shot.x / strength) * 102;
    state.seed = nextSeed(state.seed);
    const readsShot = state.seed % 4 === 0;
    state.target = readsShot ? Math.max(66, Math.min(x, 174)) : 66 + state.seed % 109;
    state.shot = { x, strength, duration: Math.round(43 - strength * 25), elapsed: 0 };
    state.message = "";
    state.cue = "shot";
  },
  draw(ctx, state) {
    field(ctx, "#28744c", "#328556");
    box(ctx, "#263747", 47, 13, 146, 35);
    for (let x = 53; x < 189; x += 9) box(ctx, "#6d8480", x, 17, 1, 28);
    for (let y = 18; y < 45; y += 6) box(ctx, "#6d8480", 51, y, 138, 1);
    box(ctx, "#e9e6b4", 47, 12, 146, 4);
    box(ctx, "#e9e6b4", 47, 13, 5, 35);
    box(ctx, "#e9e6b4", 188, 13, 5, 35);
    box(ctx, "#c7d89f", 28, 67, 184, 2);
    box(ctx, "#c7d89f", 28, 46, 2, 23);
    box(ctx, "#c7d89f", 210, 46, 2, 23);
    box(ctx, "#d3e3ad", 118, 133, 4, 3);
    box(ctx, "#ffcf74", state.keeper - 11, 41, 22, 6);
    box(ctx, "#f29949", state.keeper - 7, 34, 14, 15);
    box(ctx, "#ffe1a9", state.keeper - 4, 27, 8, 7);
    box(ctx, "#523c50", state.keeper - 8, 49, 6, 5);
    box(ctx, "#523c50", state.keeper + 2, 49, 6, 5);
    const shot = state.shot;
    const progress = shot ? shot.elapsed / shot.duration : 0;
    const x = shot ? spot.x + (shot.x - spot.x) * progress : spot.x;
    const y = spot.y + (goal.line - spot.y) * progress;
    if (state.status === "playing" || state.kicks === attempts) pixelBall(ctx, { x, y }, "#fff4d3", progress > .55 ? 3 : 5);
  },
};
