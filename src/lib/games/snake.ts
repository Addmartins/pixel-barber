import { nextSeed } from "./random";
import { DOWN, LEFT, RIGHT, UP, maxTicks, type Difficulty, type Game, type GameState } from "./types";

const width = 20;
const height = 13;
const area = width * height;
const directions = [UP, RIGHT, DOWN, LEFT];
const offsets = [-width, 1, width, -1];
const obstacles = [7 + width * 3, 14 + width * 6, 10 + width * 9];
const background = "#9eaf6a";
const ink = "#273a23";

type SnakeState = GameState & {
  difficulty: Difficulty;
  modern: boolean;
  seed: number;
  segments: number[];
  obstacles: number[];
  direction: number;
  wanted: number;
  nextMove: number;
  oils: number;
  oil: number;
  golden: number;
  goldenUntil: number;
};

function freeCell(state: SnakeState, other: number) {
  const blocked = new Set([...state.segments, ...state.obstacles, other]);
  const free: number[] = [];
  for (let cell = 0; cell < area; cell++) if (!blocked.has(cell)) free.push(cell);
  if (!free.length) return -1;
  state.seed = nextSeed(state.seed);
  return free[state.seed % free.length];
}

function pace(state: SnakeState) {
  if (state.difficulty === "HARD") return Math.max(3, 5 - Math.floor(state.oils / 8));
  if (state.difficulty === "MEDIUM") return Math.max(4, 8 - Math.floor(state.oils / 4));
  return 8;
}

export const snake: Game<SnakeState> = {
  create(seed, difficulty, version) {
    const state: SnakeState = {
      score: 0, ticks: 0, status: "playing", seed, difficulty, modern: version === 4 || version === 6 || version === 8,
      segments: [128, 127, 126], obstacles: difficulty === "HARD" ? [...obstacles] : [],
      direction: 1, wanted: 1, nextMove: 0, oils: 0, oil: -1, golden: -1, goldenUntil: 0,
    };
    state.nextMove = state.modern ? 34 : pace(state);
    state.oil = freeCell(state, -1);
    return state;
  },
  step(state, input) {
    if (state.status !== "playing") return;
    state.ticks++;
    const requested = directions.findIndex((bit) => Boolean(input & bit));
    if (requested !== -1 && requested !== (state.direction + 2) % 4) state.wanted = requested;
    if (state.goldenUntil <= state.ticks) state.golden = -1;
    if (state.ticks < state.nextMove) {
      if (state.ticks >= maxTicks) state.status = state.oils >= 15 ? "won" : "lost";
      return;
    }

    state.direction = state.wanted;
    const head = state.segments[0];
    const x = head % width;
    const next = head + offsets[state.direction];
    const ateOil = next === state.oil;
    const ateGolden = next === state.golden;
    const growth = ateOil || ateGolden;
    if (next < 0 || next >= area || (state.direction === 1 && x === width - 1) ||
        (state.direction === 3 && x === 0) || state.obstacles.includes(next) ||
        state.segments.slice(0, growth ? undefined : -1).includes(next)) {
      state.status = "lost";
      return;
    }

    state.segments.unshift(next);
    if (!growth) state.segments.pop();
    if (ateGolden) {
      state.golden = -1;
      state.score = Math.min(400, state.score + 50);
    }
    if (ateOil) {
      state.oils++;
      state.score = Math.min(400, state.score + 10);
      state.oil = freeCell(state, state.golden);
      if (state.oils % 5 === 0) {
        state.golden = freeCell(state, state.oil);
        state.goldenUntil = state.ticks + 480;
      }
    }
    if (state.oil < 0 && state.golden < 0) state.status = "won";
    else if (state.ticks >= maxTicks) state.status = state.oils >= 15 ? "won" : "lost";
    state.nextMove = state.ticks + pace(state);
  },
  draw(ctx, state, avatar) {
    const cell = (position: number, color: string, inset: number) => {
      if (position < 0) return;
      ctx.fillStyle = color;
      ctx.fillRect(20 + (position % width) * 10 + inset, 20 + Math.floor(position / width) * 10 + inset, 10 - inset * 2, 10 - inset * 2);
    };
    if (state.modern) {
      ctx.fillStyle = "#10182b"; ctx.fillRect(0, 0, 240, 160);
      ctx.fillStyle = "#426d76"; ctx.fillRect(18, 18, 204, 134);
      for (let i = 0; i < area; i++) cell(i, (i + Math.floor(i / width)) % 2 ? "#20384a" : "#263e50", 0);
      for (const rock of state.obstacles) { cell(rock, "#3f344e", 0); cell(rock, "#ae85aa", 2); }
      cell(state.oil, "#ffb56f", 2);
      cell(state.oil, "#fff3ba", 4);
      cell(state.golden, "#f9e577", 1 + Math.floor(state.ticks / 8) % 2);
      state.segments.forEach((position, index) => {
        cell(position, index ? "#246b6f" : "#98f5c3", 0);
        if (index) cell(position, index % 2 ? "#51bb9e" : "#61ceab", 2);
      });
      if (avatar) {
        const head = state.segments[0];
        ctx.drawImage(avatar, 20 + head % width * 10, 16 + Math.floor(head / width) * 10, 10, 18);
      } else {
        const head = state.segments[0];
        const x = 20 + head % width * 10;
        const y = 20 + Math.floor(head / width) * 10;
        ctx.fillStyle = "#20384a";
        const horizontal = state.direction % 2 === 1;
        const front = state.direction === 1 || state.direction === 2 ? 7 : 1;
        for (const side of [2, 6]) ctx.fillRect(x + (horizontal ? front : side), y + (horizontal ? side : front), 2, 2);
      }
      ctx.fillStyle = "#9cf3d4"; ctx.font = "bold 8px monospace"; ctx.textAlign = "left";
      ctx.fillText(`ÓLEOS ${state.oils} / 15  ·  CAUDA ${state.segments.length}`, 20, 12);
      return;
    }
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, 240, 160);
    ctx.fillStyle = ink;
    ctx.fillRect(17, 17, 206, 136);
    ctx.fillStyle = "#889b58";
    ctx.fillRect(20, 20, 200, 130);
    state.obstacles.forEach((position) => { cell(position, ink, 1); cell(position, background, 3); });
    cell(state.oil, ink, 3);
    if (Math.floor(state.ticks / 8) % 2 === 0) cell(state.golden, "#ecf4ae", 2);
    state.segments.forEach((position, index) => cell(position, index ? "#405636" : ink, index ? 1 : 0));
    ctx.fillStyle = ink;
    ctx.font = "bold 8px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`ÓLEOS ${state.oils}   BIGODE ${state.segments.length}`, 20, 11);
  },
};
