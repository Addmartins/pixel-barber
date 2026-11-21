import { DOWN, LEFT, RIGHT, UP, maxTicks, ticksPerSecond, type Game, type State } from "./types";

const plan = [
  "###################",
  "#S...#.....#.....T#",
  "#.#....###...#.#..#",
  "#.###.##.##..#.#..#",
  "#.....#....#......#",
  "###.#...##...#.#.##",
  "#...#.#....###....#",
  "#.#...#.#....#.#..#",
  "#.###...#.##...#..#",
  "#T....#....#......#",
  "###################",
];
const columns = plan[0].length;
const tileSize = 12;
const offsetX = 6;
const offsetY = 14;
const towelDuration = 480;

function position(x: number, y: number) {
  return y * columns + x;
}

const paths = plan.flatMap((row, y) => [...row].flatMap((tile, x) =>
  tile === "#" ? [] : [position(x, y)]));
const corridors = new Set(paths);
const start = position(1, 1);
const towels = [position(17, 1), position(1, 9)];
const enemySpawns = [position(17, 9), position(8, 4)];

const directions = [
  { bit: LEFT, offset: -1 },
  { bit: RIGHT, offset: 1 },
  { bit: UP, offset: -columns },
  { bit: DOWN, offset: columns },
];

type Enemy = {
  tile: number;
  spawn: number;
  previous: number;
  stunnedUntil: number;
};

type MazeState = State & {
  player: number;
  seed: number;
  nextMove: number;
  pomades: Set<number>;
  towels: Set<number>;
  enemies: Enemy[];
  lives: number;
  boostUntil: number;
  safeUntil: number;
  combo: number;
};

function nextRandom(seed: number) {
  return (Math.imul(seed, 1664525) + 1013904223) >>> 0;
}

function shuffledPaths(initialSeed: number) {
  const candidates = paths.filter((tile) => tile !== start && !towels.includes(tile) && !enemySpawns.includes(tile));
  let seed = initialSeed;
  for (let i = candidates.length - 1; i > 0; i--) {
    seed = nextRandom(seed);
    const j = seed % (i + 1);
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  return candidates;
}

function distancesFromPlayer(player: number) {
  const distances = new Map([[player, 0]]);
  const frontier = [player];
  for (let i = 0; i < frontier.length; i++) {
    const tile = frontier[i];
    const distance = distances.get(tile) ?? 0;
    for (const direction of directions) {
      const next = tile + direction.offset;
      if (!corridors.has(next) || distances.has(next)) continue;
      frontier.push(next);
      distances.set(next, distance + 1);
    }
  }
  return distances;
}

function collide(state: MazeState) {
  for (const enemy of state.enemies) {
    if (enemy.tile !== state.player || enemy.stunnedUntil !== 0) continue;
    if (state.boostUntil > state.ticks) {
      state.combo++;
      state.score = Math.min(400, state.score + Math.min(10 * state.combo, 30));
      enemy.stunnedUntil = state.ticks + 150;
      continue;
    }
    if (state.safeUntil > state.ticks) continue;
    state.lives--;
    if (state.lives === 0) {
      state.status = "lost";
      return;
    }
    state.player = start;
    state.safeUntil = state.ticks + 150;
  }
}

function stepEnemies(state: MazeState) {
  const due = state.enemies.some((enemy, index) => state.ticks % (25 + index * 5) === 0 &&
    state.ticks >= enemy.stunnedUntil);
  if (!due) return;
  const distances = distancesFromPlayer(state.player);
  state.enemies.forEach((enemy, index) => {
    if (state.ticks % (25 + index * 5) !== 0 || state.ticks < enemy.stunnedUntil) return;
    if (enemy.stunnedUntil) {
      enemy.tile = enemy.spawn;
      enemy.previous = -1;
      enemy.stunnedUntil = 0;
    }
    const adjacent = directions.map(({ offset }) => enemy.tile + offset).filter((tile) => corridors.has(tile));
    const onward = adjacent.filter((tile) => tile !== enemy.previous);
    const options = onward.length ? onward : adjacent;
    const fleeing = state.boostUntil > state.ticks;
    const sign = fleeing ? -1 : 1;
    options.sort((a, b) => sign * ((distances.get(a) ?? 0) - (distances.get(b) ?? 0)));
    state.seed = nextRandom(state.seed);
    const previous = enemy.tile;
    const wander = index === 1 && state.seed % 3 !== 0;
    enemy.tile = (wander ? options[state.seed % options.length] : options[0]) ?? previous;
    enemy.previous = previous;
  });
}

function tileX(tile: number) {
  return offsetX + tile % columns * tileSize;
}

function tileY(tile: number) {
  return offsetY + Math.floor(tile / columns) * tileSize;
}

function drawEnemy(context: CanvasRenderingContext2D, enemy: Enemy, scissors: boolean, boosted: boolean) {
  const x = tileX(enemy.tile);
  const y = tileY(enemy.tile);
  context.fillStyle = boosted ? "#52baff" : scissors ? "#f6a6c7" : "#f7b462";
  if (scissors) {
    context.fillRect(x + 2, y + 2, 3, 4);
    context.fillRect(x + 7, y + 2, 3, 4);
    context.fillRect(x + 4, y + 5, 4, 3);
    context.fillRect(x + 3, y + 8, 2, 3);
    context.fillRect(x + 7, y + 8, 2, 3);
  } else {
    context.fillRect(x + 2, y + 4, 8, 5);
    context.fillRect(x + 4, y + 2, 2, 8);
    context.fillRect(x + 7, y + 3, 2, 7);
  }
  context.fillStyle = "#211423";
  context.fillRect(x + 4, y + 5, 1, 2);
  context.fillRect(x + 7, y + 5, 1, 2);
}

export const maze: Game<MazeState> = {
  create(seed) {
    return {
      score: 0,
      ticks: 0,
      status: "playing",
      player: start,
      seed,
      nextMove: 0,
      pomades: new Set(shuffledPaths(seed).slice(0, 17)),
      towels: new Set(towels),
      enemies: enemySpawns.map((tile) => ({ tile, spawn: tile, previous: -1, stunnedUntil: 0 })),
      lives: 3,
      boostUntil: 0,
      safeUntil: 0,
      combo: 0,
    };
  },

  step(state, input) {
    if (state.status !== "playing") return;
    state.ticks++;
    if (state.ticks >= state.nextMove) {
      const move = directions.find(({ bit, offset }) => (input & bit) && corridors.has(state.player + offset));
      if (move) {
        state.player += move.offset;
        state.nextMove = state.ticks + 8;
        if (state.pomades.delete(state.player)) state.score = Math.min(400, state.score + 10);
        if (state.towels.delete(state.player)) {
          state.score = Math.min(400, state.score + 50);
          state.boostUntil = state.ticks + towelDuration;
          state.combo = 0;
        }
      }
    }
    collide(state);
    if (state.status !== "playing") return;
    if (state.pomades.size === 0) {
      state.status = "won";
      return;
    }
    stepEnemies(state);
    collide(state);
    if (state.ticks >= maxTicks) state.status = "lost";
  },

  draw(context, state) {
    context.fillStyle = "#10121d";
    context.fillRect(0, 0, 240, 160);
    context.font = "8px monospace";
    context.textBaseline = "top";
    context.fillStyle = "#ffe3b2";
    context.fillText(`POMADAS ${17 - state.pomades.size}/17`, 7, 4);
    context.fillText(`VIDAS ${state.lives}`, 92, 4);
    context.fillText(`${Math.ceil((maxTicks - state.ticks) / ticksPerSecond)}s`, 214, 4);

    for (let y = 0; y < plan.length; y++) {
      for (let x = 0; x < columns; x++) {
        if (plan[y][x] !== "#") continue;
        const left = offsetX + x * tileSize;
        const top = offsetY + y * tileSize;
        context.fillStyle = "#343854";
        context.fillRect(left, top, 12, 12);
        context.fillStyle = "#505577";
        context.fillRect(left + 1, top + 1, 10, 2);
        context.fillStyle = "#212438";
        context.fillRect(left + 1, top + 9, 10, 2);
      }
    }

    for (const tile of state.pomades) {
      const x = tileX(tile);
      const y = tileY(tile);
      context.fillStyle = "#f0b96a";
      context.fillRect(x + 4, y + 4, 5, 5);
      context.fillStyle = "#fff3ca";
      context.fillRect(x + 3, y + 3, 7, 2);
    }
    for (const tile of state.towels) {
      const x = tileX(tile);
      const y = tileY(tile);
      context.fillStyle = "#f9a4df";
      context.fillRect(x + 2, y + 3, 8, 6);
      context.fillStyle = "#fff0f6";
      context.fillRect(x + 5, y + 4, 4, 1);
      context.fillRect(x + 5, y + 6, 4, 1);
    }
    const boosted = state.boostUntil > state.ticks;
    state.enemies.forEach((enemy, index) => {
      if (!enemy.stunnedUntil) drawEnemy(context, enemy, index === 1, boosted);
    });

    if (state.safeUntil <= state.ticks || Math.floor(state.ticks / 6) % 2 === 0) {
      const x = tileX(state.player);
      const y = tileY(state.player);
      context.fillStyle = boosted ? "#b2f9ff" : "#77f1c3";
      context.fillRect(x + 2, y + 6, 7, 4);
      context.fillRect(x + 4, y + 2, 4, 6);
      context.fillStyle = "#faeaf6";
      context.fillRect(x + 8, y + 3, 2, 5);
    }
    if (boosted) {
      context.fillStyle = "#8ce8ff";
      context.fillText(`TOALHA QUENTE! COMBO ${state.combo}`, 7, 150);
    } else {
      context.fillStyle = "#bdb8df";
      context.fillText("POMADA +10   TOALHA +50", 7, 150);
    }
  },
};
