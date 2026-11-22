import { repeatDirection, type DirectionalRepeat } from "./directional-repeat";
import { A, DOWN, LEFT, RIGHT, UP, maxTicks, type Game, type GameState } from "./types";

const width = 13;
const height = 9;
const tile = 15;
const originX = 22;
const originY = 18;
const maze = [
  "#############",
  "#S...#.....o#",
  "#.#..#.###..#",
  "#.#....#....#",
  "#o..##...#.o#",
  "#.#....#....#",
  "#.###..#..#.#",
  "#o....#.....#",
  "#############",
].join("");
const workshop = [
  "#############",
  "#S..c..c....#",
  "#.#.#.#.#.#.#",
  "#..c..c..c..#",
  "#.#.#.#.#.#.#",
  "#c...c...c..#",
  "#.#.#.#.#.#.#",
  "#...c..c....#",
  "#############",
].join("");
const controls = [[LEFT, -1, 0], [RIGHT, 1, 0], [UP, 0, -1], [DOWN, 0, 1]] as const;
const spawn = width + 1;

type Guard = { cell: number; home: number; safeUntil: number };
type Arena = GameState & {
  bombMode: boolean; controlled: boolean; repeat: DirectionalRepeat; field: string[]; player: number; facing: number; moved: number; lives: number; invulnerable: number;
  guards: Guard[]; seed: number; previous: number; direction: number; moveAt: number; guardPace: number;
  pellets: Set<number>; total: number; picked: number; powerUntil: number;
  bombs: { cell: number; fuse: number }[]; flames: Map<number, number>; crates: number;
};

function adjacent(cell: number, direction: number) {
  const [, dx, dy] = controls[direction];
  const x = cell % width + dx;
  const y = Math.floor(cell / width) + dy;
  return x >= 0 && x < width && y >= 0 && y < height ? y * width + x : -1;
}
function open(state: Arena, cell: number) {
  return cell >= 0 && state.field[cell] !== "#" && state.field[cell] !== "c";
}
function random(state: Arena) {
  state.seed = (Math.imul(state.seed, 1664525) + 1013904223) >>> 0;
  return state.seed;
}
function distances(state: Arena) {
  const distance = new Map([[state.player, 0]]);
  const queue = [state.player];
  for (const cell of queue) for (let d = 0; d < controls.length; d++) {
    const next = adjacent(cell, d);
    if (!open(state, next) || distance.has(next)) continue;
    distance.set(next, distance.get(cell)! + 1);
    queue.push(next);
  }
  return distance;
}

function moveGuards(state: Arena) {
  const distance = distances(state);
  const powered = state.ticks < state.powerUntil;
  for (const guard of state.guards) {
    if (guard.safeUntil > state.ticks) continue;
    const candidates = controls.map((_, d) => adjacent(guard.cell, d)).filter(cell =>
      open(state, cell) && !state.bombs.some(bomb => bomb.cell === cell));
    if (!candidates.length) continue;
    const roll = random(state) >>> 16;
    if (state.bombMode || roll % 4 === 0) guard.cell = candidates[roll % candidates.length];
    else {
      const rank = (cell: number) => distance.get(cell) ?? width * height;
      guard.cell = candidates.reduce((best, next) => (powered ? rank(next) > rank(best) : rank(next) < rank(best)) ? next : best);
    }
  }
}

function detonate(state: Arena) {
  for (const [cell, end] of state.flames) if (end <= state.ticks) state.flames.delete(cell);
  for (let bomb = state.bombs.find(b => b.fuse <= state.ticks); bomb; bomb = state.bombs.find(b => b.fuse <= state.ticks)) {
    state.bombs = state.bombs.filter(b => b !== bomb);
    const flame = (cell: number) => {
      state.flames.set(cell, state.ticks + 19);
      const chain = state.bombs.find(b => b.cell === cell);
      if (chain) chain.fuse = state.ticks;
    };
    flame(bomb.cell);
    for (let d = 0; d < controls.length; d++) {
      let cell = bomb.cell;
      for (let distance = 0; distance < 2; distance++) {
        cell = adjacent(cell, d);
        if (cell < 0 || state.field[cell] === "#") break;
        flame(cell);
        if (state.field[cell] === "c") {
          state.field[cell] = ".";
          state.crates--;
          state.score += 15;
          break;
        }
      }
    }
  }
}

function takeHit(state: Arena) {
  if (state.status !== "playing" || state.ticks < state.invulnerable) return;
  state.lives--;
  if (!state.lives) state.status = "lost";
  else {
    state.player = spawn;
    state.direction = -1;
    state.invulnerable = state.ticks + 105;
  }
}

function step(state: Arena, input: number) {
  state.ticks++;
  if (state.bombMode) {
    if ((input & A) && !(state.previous & A) && state.bombs.length < 2 &&
      !state.flames.has(state.player) && !state.bombs.some(bomb => bomb.cell === state.player)) {
      state.bombs.push({ cell: state.player, fuse: state.ticks + 95 });
    }
    detonate(state);
  }
  const requested = controls.findIndex(([mask]) => Boolean(input & mask));
  if (requested >= 0) state.direction = requested;
  const move = state.controlled
    ? repeatDirection(state.repeat, requested, state.ticks, state.bombMode ? 8 : 7)
    : state.ticks >= state.moveAt && state.direction >= 0 && (requested >= 0 || !state.bombMode);
  if (move) {
    const next = adjacent(state.player, state.direction);
    if (open(state, next) && !state.bombs.some(bomb => bomb.cell === next)) {
      state.player = next;
      state.moved = state.ticks;
      if (state.direction < 2) state.facing = state.direction === 0 ? -1 : 1;
      state.moveAt = state.ticks + (state.bombMode ? 8 : 7);
    }
  }
  state.previous = input;
  if (state.pellets.delete(state.player)) {
    state.picked++;
    state.score += 5;
    if (state.field[state.player] === "o") {
      state.powerUntil = state.ticks + 340;
      state.field[state.player] = ".";
    }
  }
  if (state.ticks % state.guardPace === 0) moveGuards(state);
  for (const guard of state.guards) {
    if (state.bombMode && state.flames.has(guard.cell)) {
      guard.safeUntil = -1;
      state.score += 40;
    } else if (guard.cell === state.player && guard.safeUntil <= state.ticks) {
      if (!state.bombMode && state.ticks < state.powerUntil) {
        state.score += 20;
        guard.cell = guard.home;
        guard.safeUntil = state.ticks + 90;
      } else takeHit(state);
    }
  }
  state.guards = state.guards.filter(guard => guard.safeUntil !== -1);
  if (state.flames.has(state.player)) takeHit(state);
  state.score = Math.min(400, state.score);
  if (state.status === "playing") {
    if (state.bombMode ? state.guards.length === 0 : state.pellets.size === 0) state.status = "won";
    else if (state.ticks >= maxTicks) state.status = "lost";
  }
}

function draw(ctx: CanvasRenderingContext2D, state: Arena, avatar?: CanvasImageSource) {
  const backdrop = state.bombMode ? "#201825" : "#131f2b";
  const accent = state.bombMode ? "#f2a279" : "#7debd0";
  const xy = (cell: number) => [originX + cell % width * tile, originY + Math.floor(cell / width) * tile];
  const rect = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), w, h);
  };
  rect(0, 0, 240, 160, backdrop);
  // Barber poles frame the shelves at the edges of the playfield.
  for (const x of [5, 229]) {
    rect(x, 28, 6, 96, "#414152");
    for (let y = 30; y < 120; y += 6) rect(x + 1, y, 4, 3, y % 12 === 6 ? "#c58487" : "#bad9d9");
  }
  state.field.forEach((cell, position) => {
    const [x, y] = xy(position);
    rect(x, y, tile - 1, tile - 1, position % 2 ? "#293342" : "#303b49");
    if (cell === "#") {
      rect(x, y, 14, 14, state.bombMode ? "#59404a" : "#3b5962");
      rect(x + 1, y + 1, 12, 2, state.bombMode ? "#885b62" : "#61848a");
      rect(x + 2, y + 10, 10, 1, "#242b3b");
    } else if (cell === "c") {
      rect(x + 1, y + 2, 12, 11, "#ba784e");
      rect(x + 2, y + 4, 10, 2, "#e8af72");
      rect(x + 5, y + 7, 4, 3, "#724d45");
    } else if (state.pellets.has(position)) {
      if (cell === "o") {
        rect(x + 5, y + 3, 4, 2, "#ffe39c");
        rect(x + 4, y + 5, 6, 7, "#ea9e75");
      } else {
        rect(x + 6, y + 6, 3, 3, "#e5bb81");
        rect(x + 6, y + 6, 1, 1, "#fff0c3");
      }
    }
  });
  for (const bomb of state.bombs) {
    const [x, y] = xy(bomb.cell);
    rect(x + 3, y + 5, 9, 8, "#161828");
    rect(x + 5, y + 4, 5, 8, "#646882");
    rect(x + 9, y + 2, 3, 3, Math.floor(state.ticks / 7) % 2 ? "#ffe79d" : "#fd7f71");
  }
  for (const cell of state.flames.keys()) {
    const [x, y] = xy(cell);
    rect(x + 1, y + 1, 12, 12, "#f39b62");
    rect(x + 4, y + 4, 6, 6, "#fff4bc");
  }
  for (const [index, guard] of state.guards.entries()) {
    if (guard.safeUntil > state.ticks) continue;
    const [x, y] = xy(guard.cell);
    const color = state.ticks < state.powerUntil ? "#899fcf" : ["#ee8793", "#ab96dc", "#f1b778"][index % 3];
    rect(x + 2, y + 3, 11, 8, color);
    rect(x + 5, y + 1, 5, 11, color);
    rect(x + 4, y + 5, 7, 3, "#20263a");
    rect(x + 8, y + 6, 2, 1, "#ffe2a0");
    rect(x + 4, y + 11, 6, 2, "#1c2334");
  }
  if (state.ticks >= state.invulnerable || Math.floor(state.ticks / 5) % 2 === 0) {
    const [x, y] = xy(state.player);
    rect(x + 3, y + 12, 9, 2, "#121b29");
    if (avatar) {
      ctx.save();
      ctx.translate(x + 7, y + 13 + (state.ticks - state.moved < 5 ? -1 : 0));
      ctx.scale(state.facing, 1);
      ctx.drawImage(avatar, -5, -17, 10, 18);
      ctx.restore();
    } else {
      rect(x + 3, y + 4, 9, 9, accent);
      rect(x + 6, y + 5, 2, 2, backdrop);
    }
  }
  ctx.font = "bold 8px monospace";
  ctx.fillStyle = accent;
  ctx.textAlign = "left";
  ctx.fillText(state.bombMode ? `ROBÔS ${state.guards.length} · CAIXAS ${state.crates}` : `FICHAS ${state.picked}/${state.total}${state.powerUntil > state.ticks ? " · TURBO" : ""}`, 22, 12);
  ctx.textAlign = "right";
  ctx.fillText(`${state.lives} VIDAS`, 217, 12);
}

export function barbershopArena(bombMode: boolean): Game<Arena> {
  return {
    create(seed, difficulty, version = 10) {
      const field = [...(bombMode ? workshop : maze)];
      const pellets = new Set(bombMode ? [] : field.flatMap((cell, i) => cell === "." || cell === "o" ? [i] : []));
      const positions = bombMode ? [width + 10, 5 * width + 8, 7 * width + 3] : [width + 10, 7 * width + 9, 7 * width + 2];
      const guardCount = difficulty === "EASY" ? 2 : 3;
      return {
        bombMode, controlled: version >= 10, repeat: { direction: -1, next: 0 }, field, seed, player: spawn, facing: 1, moved: 0, lives: difficulty === "HARD" ? 2 : 3,
        invulnerable: 0, guards: positions.slice(0, guardCount).map(cell => ({ cell, home: cell, safeUntil: 0 })),
        previous: 0, direction: -1, moveAt: 0, guardPace: difficulty === "HARD" ? 11 : difficulty === "MEDIUM" ? 15 : 22,
        pellets, picked: 0, total: pellets.size, powerUntil: 0, bombs: [], flames: new Map(),
        crates: field.filter(cell => cell === "c").length, ticks: 0, score: 0, status: "playing",
      };
    },
    step,
    draw,
  };
}
