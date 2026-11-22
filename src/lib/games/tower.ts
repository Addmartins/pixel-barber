import {
  A, LEFT, RIGHT, UP, canvasHeight as HEIGHT, canvasWidth as WIDTH,
  gameVersion, ticksPerSecond, type EngineVersion, type Difficulty, type Game, type GameState,
} from "./types";

const SCALE = 16;
const FLOOR = 530;
const PLATFORM_HEIGHT = 8;
const PLAYER_HALF = 5;
const timeLimits: Record<Difficulty, number> = { EASY: 60, MEDIUM: 45, HARD: 30 };

type Kind = "floor" | "chair" | "belt" | "goal";
type Platform = {
  x: number;
  origin: number;
  y: number;
  width: number;
  kind: Kind;
  belt: number;
  puddle: { x: number; width: number } | null;
};

type TowerState = GameState & {
  platforms: Platform[];
  x: number;
  y: number;
  vx: number;
  vy: number;
  resting: Platform | null;
  jumpHeld: boolean;
  version: EngineVersion;
  coyoteUntil: number;
  bufferUntil: number;
  camera: number;
  limit: number;
  moving: boolean;
};

function platformOffset(ticks: number, index: number) {
  const phase = (Math.floor(ticks / 3) + index * 11) % 64;
  return 16 - Math.abs(phase - 32);
}

function buildTower(seed: number, difficulty: Difficulty): Platform[] {
  const floor: Platform = { x: 0, origin: 0, y: FLOOR, width: WIDTH, kind: "floor", belt: 0, puddle: null };
  const landings = Array.from({ length: 8 }, (_, index): Platform => {
    const onLeft = (index + (seed & 1)) % 2 === 0;
    const kind = index % 3 === 1 ? "belt" : "chair";
    const variation = (seed >>> (index + 1)) % 13;
    const origin = onLeft ? 18 + variation : 117 - variation;
    return {
      x: origin + (difficulty === "MEDIUM" ? platformOffset(0, index + 1) : 0),
      origin,
      y: FLOOR - (index + 1) * 52,
      width: difficulty === "MEDIUM" ? 102 : 93,
      kind,
      belt: difficulty === "HARD" && kind === "belt" ? (onLeft ? -24 : 24) : 0,
      puddle: index % 3 === 2 ? { x: onLeft ? 23 : 47, width: difficulty === "EASY" ? 10 : 22 } : null,
    };
  });
  return [floor, ...landings, { x: 83, origin: 83, y: FLOOR - 9 * 52, width: 74, kind: "goal", belt: 0, puddle: null }];
}

function overPlatform(x: number, platform: Platform) {
  const center = x / SCALE;
  return center + PLAYER_HALF > platform.x && center - PLAYER_HALF < platform.x + platform.width;
}

function drawPlatform(ctx: CanvasRenderingContext2D, platform: Platform, y: number, ticks: number) {
  const { x, width, kind, belt, puddle } = platform;
  const surface = kind === "goal" ? "#f5c66f" : kind === "belt" ? "#5de4ce" : "#ec80ae";
  ctx.fillStyle = surface;
  ctx.fillRect(x, y, width, 3);
  ctx.fillStyle = kind === "floor" ? "#653e70" : "#503659";
  ctx.fillRect(x, y + 3, width, PLATFORM_HEIGHT - 3);

  if (kind === "chair") {
    const direction = x < WIDTH / 2 - 30 ? 1 : -1;
    const end = direction > 0 ? x + 3 : x + width - 8;
    ctx.fillStyle = "#ec80ae";
    ctx.fillRect(end, y - 6, 5, 7);
    ctx.fillStyle = "#95628f";
    ctx.fillRect(x + Math.floor(width / 2) - 4, y + PLATFORM_HEIGHT, 8, 9);
    ctx.fillRect(x + Math.floor(width / 2) - 10, y + PLATFORM_HEIGHT + 8, 20, 3);
  }

  if (kind === "belt") {
    ctx.fillStyle = "#217e80";
    const offset = (Math.floor(ticks / 2) * Math.sign(belt) + 12 * WIDTH) % 12;
    for (let mark = offset; mark + 3 < width; mark += 12) {
      ctx.fillRect(x + mark, y + 4, 3, 3);
    }
  }

  if (puddle !== null) {
    ctx.fillStyle = "#74aafa";
    ctx.fillRect(x + puddle.x, y - 2, puddle.width, 2);
    ctx.fillStyle = "#c3f4ff";
    ctx.fillRect(x + puddle.x + 2, y - 3, Math.floor(puddle.width / 3), 1);
  }

  if (kind === "goal") {
    const center = x + Math.floor(width / 2);
    ctx.fillStyle = "#905a58";
    ctx.fillRect(center - 11, y - 26, 22, 22);
    ctx.fillStyle = "#f5c66f";
    ctx.fillRect(center - 9, y - 24, 18, 15);
    ctx.fillRect(center - 15, y - 9, 30, 4);
    ctx.fillRect(center - 3, y - 5, 6, 5);
    ctx.fillStyle = "#fff2b0";
    ctx.fillRect(center - 5, y - 21, 10, 3);
  }
}

export const tower: Game<TowerState> = {
  create(seed, difficulty: Difficulty = "EASY", version = gameVersion) {
    const platforms = buildTower(seed, difficulty);
    return {
      score: 0,
      ticks: 0,
      status: "playing",
      platforms,
      x: (seed & 1 ? 155 : 63) * SCALE,
      y: FLOOR * SCALE,
      vx: 0,
      vy: 0,
      resting: platforms[0],
      jumpHeld: false, version, coyoteUntil: -1, bufferUntil: -1, jumps: 0,
      camera: FLOOR + 18 - HEIGHT,
      limit: timeLimits[difficulty] * ticksPerSecond,
      moving: difficulty === "MEDIUM",
    };
  },

  step(state, input) {
    if (state.status !== "playing") return;
    state.ticks++;
    if (state.ticks >= state.limit) {
      state.status = "lost";
      return;
    }

    const jump = Boolean(input & (A | UP));
    const direction = Number(Boolean(input & RIGHT)) - Number(Boolean(input & LEFT));
    const ground = state.resting;
    if (state.moving) {
      for (let index = 1; index < state.platforms.length - 1; index++) {
        const platform = state.platforms[index];
        const nextX = platform.origin + platformOffset(state.ticks, index);
        if (ground === platform) state.x += (nextX - platform.x) * SCALE;
        platform.x = nextX;
      }
    }
    const localX = ground ? state.x / SCALE - ground.x : 0;
    const puddle = ground?.puddle;
    const slippery = Boolean(puddle && localX >= puddle.x && localX < puddle.x + puddle.width);
    const speed = slippery ? 38 : 34;
    const acceleration = slippery ? 2 : 7;
    const target = direction * speed;
    state.vx += Math.max(-acceleration, Math.min(acceleration, target - state.vx));

    function launch() {
      state.vy = -104;
      state.resting = null;
      state.coyoteUntil = -1;
      state.bufferUntil = -1;
      state.jumps = (state.jumps ?? 0) + 1;
    }

    const pressed = jump && !state.jumpHeld;
    if (state.version === 2) {
      if (pressed && ground) launch();
    } else {
      if (pressed) state.bufferUntil = state.ticks + 6;
      if (state.bufferUntil >= state.ticks && (ground || state.coyoteUntil >= state.ticks)) launch();
    }
    state.jumpHeld = jump;

    const carried = state.resting?.belt ?? 0;
    state.x = Math.max(PLAYER_HALF * SCALE, Math.min((WIDTH - PLAYER_HALF) * SCALE, state.x + state.vx + carried));
    if (state.resting && !overPlatform(state.x, state.resting)) {
      state.resting = null;
      if (state.version !== 2) state.coyoteUntil = state.ticks + 5;
    }
    if (!state.resting) {
      const previousY = state.y;
      state.vy += 5;
      state.y += state.vy;
      if (state.vy > 0) {
        for (let index = state.platforms.length - 1; index >= 0; index--) {
          const platform = state.platforms[index];
          const platformY = platform.y * SCALE;
          if (previousY <= platformY && state.y >= platformY && overPlatform(state.x, platform)) {
            state.y = platformY;
            state.vy = 0;
            state.resting = platform;
            if (platform.kind === "goal") {
              state.status = "won";
              state.score = 100 + Math.floor((state.limit - state.ticks) * 150 / state.limit);
            } else if (state.version !== 2 && state.bufferUntil >= state.ticks) {
              launch();
            }
            break;
          }
        }
      }
    }

    const targetCamera = Math.max(0, Math.min(FLOOR + 18 - HEIGHT, Math.floor(state.y / SCALE) - 104));
    state.camera += Math.max(-5, Math.min(5, targetCamera - state.camera));
  },

  draw(ctx, state) {
    ctx.fillStyle = "#1d2037";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    for (let x = 0; x < WIDTH; x += 40) {
      for (let y = -32; y < HEIGHT; y += 24) {
        const tile = y + (Math.floor(x / 40) % 2) * 12 - state.camera % 24;
        ctx.fillStyle = "#282941";
        ctx.fillRect(x + 2, tile, 37, 20);
        ctx.fillStyle = "#30324b";
        ctx.fillRect(x + 3, tile + 2, 20, 1);
      }
    }
    ctx.fillStyle = "#594468";
    ctx.fillRect(0, 0, 4, HEIGHT);
    ctx.fillRect(WIDTH - 4, 0, 4, HEIGHT);

    for (const platform of state.platforms) {
      const y = platform.y - state.camera;
      if (y > -20 && y < HEIGHT + 25) drawPlatform(ctx, platform, y, state.ticks);
    }

    const x = Math.floor(state.x / SCALE);
    const y = Math.floor(state.y / SCALE) - state.camera;
    ctx.fillStyle = "#131527";
    ctx.fillRect(x - 5, y - 14, 10, 14);
    ctx.fillStyle = "#edb380";
    ctx.fillRect(x - 4, y - 12, 8, 5);
    ctx.fillStyle = "#f6cb70";
    ctx.fillRect(x - 5, y - 15, 10, 3);
    ctx.fillStyle = "#6ae5cf";
    ctx.fillRect(x - 4, y - 7, 8, 5);
    ctx.fillStyle = "#f5e8df";
    ctx.fillRect(x - 4, y - 2, 3, 2);
    ctx.fillRect(x + 1, y - 2, 3, 2);

    ctx.fillStyle = "#15192a";
    ctx.fillRect(5, 4, 230, 16);
    ctx.fillStyle = "#f5c66f";
    ctx.font = "bold 9px monospace";
    ctx.textBaseline = "top";
    ctx.fillText(`TEMPO ${String(Math.ceil((state.limit - state.ticks) / ticksPerSecond)).padStart(2, "0")}`, 10, 8);
    ctx.fillStyle = "#6ae5cf";
    const progress = Math.max(0, Math.min(100, Math.floor(100 * (FLOOR - state.y / SCALE) / (9 * 52))));
    ctx.fillText(`ALTURA ${progress}%`, 161, 8);
  },
};
