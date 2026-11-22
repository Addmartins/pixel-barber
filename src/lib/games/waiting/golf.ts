import type { Game } from "../types";
import { ballAt, box, distance, field, launch, moving, pixelBall, slow, waitingState, type Ball, type Vector, type WaitingState } from "./common";

type Wall = Vector & { width: number; height: number };
const courses: { start: Vector; cup: Vector; walls: Wall[] }[] = [
  { start: { x: 42, y: 80 }, cup: { x: 194, y: 80 }, walls: [] },
  { start: { x: 42, y: 120 }, cup: { x: 198, y: 40 }, walls: [{ x: 103, y: 64, width: 12, height: 82 }] },
  { start: { x: 42, y: 111 }, cup: { x: 194, y: 31 }, walls: [
    { x: 84, y: 14, width: 12, height: 84 }, { x: 141, y: 62, width: 12, height: 84 },
  ] },
];
const radius = 4;
const bounds = { left: 16, top: 14, right: 224, bottom: 146 };
type Golf = WaitingState & { hole: number; ball: Ball; strokes: number; total: number; pause: number };

function resetBall(position: Vector) { return ballAt(position.x, position.y); }

function advance(ball: Ball, walls: Wall[], axis: keyof Vector) {
  const horizontal = axis === "x";
  const velocity = horizontal ? "vx" : "vy";
  const other = horizontal ? "y" : "x";
  const start = (horizontal ? bounds.left : bounds.top) + radius;
  const end = (horizontal ? bounds.right : bounds.bottom) - radius;
  const next = ball[axis] + ball[velocity];
  const wall = walls.find(wall => {
    const length = horizontal ? wall.width : wall.height;
    const depth = horizontal ? wall.height : wall.width;
    return next > wall[axis] - radius && next < wall[axis] + length + radius
      && ball[other] > wall[other] - radius && ball[other] < wall[other] + depth + radius;
  });
  if (wall) {
    const length = horizontal ? wall.width : wall.height;
    ball[axis] = ball[velocity] >= 0 ? wall[axis] - radius : wall[axis] + length + radius;
    ball[velocity] *= -.78;
  } else if (next < start || next > end) {
    ball[axis] = Math.max(start, Math.min(end, next));
    ball[velocity] *= -.78;
  } else {
    ball[axis] = next;
  }
}

function updateLabel(state: Golf) {
  state.label = `Buraco ${state.hole + 1}/3 · ${state.strokes} tacadas · ${state.total} no total`;
}

export const golf: Game<Golf> = {
  create: () => ({
    ...waitingState("Buraco 1/3 · 0 tacadas · 0 no total"),
    hole: 0, ball: resetBall(courses[0].start), strokes: 0, total: 0, pause: 0,
  }),
  step(state, input) {
    state.ticks++;
    if (state.pause) {
      if (--state.pause) return;
      if (state.hole === courses.length - 1) {
        state.status = "won";
        state.label = `3 buracos · ${state.total} tacadas no total`;
      } else {
        state.hole++;
        state.strokes = 0;
        state.ball = resetBall(courses[state.hole].start);
        state.message = "";
        updateLabel(state);
      }
      return;
    }
    const { ball } = state;
    const { walls, cup } = courses[state.hole];
    if (!moving(ball)) {
      if (!input) return;
      launch(ball, input, 5.6);
      state.strokes++;
      state.total++;
      state.cue = "shot";
      updateLabel(state);
    }
    advance(ball, walls, "x");
    advance(ball, walls, "y");
    slow(ball, .972);
    if (distance(cup, ball) <= 6 && Math.hypot(ball.vx, ball.vy) < 2.4) {
      state.ball = resetBall(cup);
      state.score++;
      state.pause = 42;
      state.message = `Buraco concluído em ${state.strokes} ${state.strokes === 1 ? "tacada" : "tacadas"}!`;
      state.cue = "score";
    }
  },
  draw(ctx, state) {
    const { walls, cup } = courses[state.hole];
    field(ctx, "#244b3a", "#2a5740");
    box(ctx, "#558260", 11, 9, 218, 142);
    box(ctx, "#48773e", bounds.left, bounds.top, 208, 132);
    for (let x = 16; x < 224; x += 24) box(ctx, "#507e42", x, 14, 8, 132);
    for (const wall of walls) {
      box(ctx, "#343446", wall.x - 1, wall.y - 1, wall.width + 2, wall.height + 2);
      box(ctx, "#b98161", wall.x, wall.y, wall.width, wall.height);
      box(ctx, "#dfa881", wall.x, wall.y, 3, wall.height);
    }
    box(ctx, "#75914e", cup.x - 12, cup.y - 11, 24, 22);
    box(ctx, "#222a32", cup.x - 5, cup.y - 3, 10, 6);
    box(ctx, "#fff4cf", cup.x, cup.y - 17, 1, 15);
    box(ctx, "#ff8b75", cup.x + 1, cup.y - 17, 9, 5);
    if (!state.pause && state.status === "playing") pixelBall(ctx, state.ball, "#fff0d2", radius);
  },
};
