import { nextSeed } from "./random";
import { A, B, DOWN, LEFT, RIGHT, UP, gameVersion, roundSeconds, type EngineVersion, type Difficulty, type Game, type GameState } from "./types";

const floors = [142, 114, 86, 58, 30];
const ladders = [188, 60, 172, 82];
const left = 22;
const right = 217;
const goal = 144;
const comb = { x: 126, row: 1 };
type Hazard = { x: number; row: number; direction: number; kind: "jar" | "lotion"; hit: boolean; descends: boolean };

type KongState = GameState & {
  seed: number; difficulty: Difficulty; x: number; row: number;
  climb: number; climbTo: number; jump: number; previous: number; lives: number;
  version: EngineVersion; airY: number | null; vy: number; coyoteUntil: number; bufferUntil: number;
  invincibleUntil: number; combUntil: number; combUsed: boolean; hazards: Hazard[];
};

function heightAt(state: KongState) {
  if (state.airY !== null) return state.airY;
  if (state.climb) {
    const direction = state.climbTo > state.row ? -1 : 1;
    return floors[state.row] + direction * state.climb;
  }
  if (!state.jump) return floors[state.row];
  return floors[state.row] - Math.round(state.jump * (31 - state.jump) * .105);
}

function addHazard(state: KongState, lotion = false) {
  state.seed = nextSeed(state.seed);
  const direction = state.seed & 1 ? 1 : -1;
  const row = lotion ? 0 : floors.length - 1;
  state.hazards.push({
    row, x: direction === 1 ? left : right, direction,
    kind: lotion ? "lotion" : "jar", hit: false, descends: state.difficulty !== "EASY" && (state.seed >>> 4) % 3 !== 0,
  });
}

function stepHazards(state: KongState) {
  const speed = state.difficulty === "EASY" ? .58 : state.difficulty === "MEDIUM" ? .88 : 1.12;
  const powered = state.combUntil > state.ticks;
  const remaining: Hazard[] = [];
  for (const hazard of state.hazards) {
    const oldX = hazard.x;
    hazard.x += hazard.direction * (hazard.kind === "lotion" ? speed * .85 : speed);
    const ladder = ladders[hazard.row - 1];
    if (hazard.descends && hazard.row > 0 && (oldX - ladder) * (hazard.x - ladder) <= 0) {
      hazard.row--;
      hazard.x = ladder;
    }
    if (hazard.x < left - 8 || hazard.x > right + 8) continue;

    const bounce = state.difficulty === "HARD" && hazard.kind === "jar" && Math.floor((state.ticks + hazard.row * 6) / 7) % 4 === 1 ? 4 : 0;
    const near = state.row === hazard.row && Math.abs(state.x - hazard.x) < 8 && !state.climb && (state.version === 2 || heightAt(state) <= floors[hazard.row] + 4);
    if (near && heightAt(state) >= floors[hazard.row] - 9 - bounce) {
      if (powered) {
        state.score = Math.min(350, state.score + 20);
        continue;
      }
      if (state.invincibleUntil <= state.ticks) {
        state.lives--;
        state.invincibleUntil = state.ticks + 90;
        if (!state.lives) state.status = "lost";
      }
    } else if (near && (state.jump || (state.airY !== null && state.airY < floors[state.row])) && !hazard.hit && hazard.kind === "jar") {
      hazard.hit = true;
      state.score = Math.min(350, state.score + 10);
    }
    remaining.push(hazard);
  }
  state.hazards = remaining;
}

function moveOnLadder(state: KongState, vertical: number) {
  if (!vertical) return;
  state.climb += (vertical === Math.sign(state.climbTo - state.row) ? 1 : -1) * 1.25;
  if (state.climb >= 28) {
    state.row = state.climbTo;
    state.climb = 0;
  } else if (state.climb <= 0) state.climb = 0;
}

function enterLadder(state: KongState, vertical: number) {
  const target = state.row + vertical;
  const ladder = ladders[Math.min(state.row, target)];
  if (!vertical || target < 0 || target >= floors.length || Math.abs(state.x - ladder) >= 7) return false;
  state.x = ladder;
  state.climbTo = target;
  state.climb = 1;
  return true;
}

function legacyMovement(state: KongState, pressed: number, horizontal: number, vertical: number) {
  if (state.climb) return moveOnLadder(state, vertical);
  state.x = Math.min(right, Math.max(left, state.x + horizontal * 1.45));
  if (state.jump) state.jump = state.jump < 30 ? state.jump + 1 : 0;
  else if (!enterLadder(state, vertical) && pressed & A) state.jump = 1;
}

function overBeam(x: number, row: number) {
  return row === 0 || (x + 3 >= 16 + row * 2 && x - 3 < 223 - row * 2);
}

function polishedMovement(state: KongState, pressed: number, horizontal: number, vertical: number) {
  if (pressed & A) state.bufferUntil = state.ticks + 6;

  function launch() {
    state.airY ??= floors[state.row];
    state.vy = -3.35;
    state.coyoteUntil = -1;
    state.bufferUntil = -1;
    state.jumps = (state.jumps ?? 0) + 1;
  }

  if (state.climb) {
    moveOnLadder(state, vertical);
    if (!state.climb && state.bufferUntil >= state.ticks) launch();
    return;
  }

  if (state.bufferUntil >= state.ticks && (state.airY === null || state.coyoteUntil >= state.ticks)) launch();
  state.x = Math.min(232, Math.max(8, state.x + horizontal * 1.45));

  if (state.airY === null) {
    if (!overBeam(state.x, state.row)) {
      state.airY = floors[state.row];
      state.vy = 0;
      state.coyoteUntil = state.ticks + 5;
    } else {
      enterLadder(state, vertical);
      return;
    }
  }

  const previous = state.airY;
  state.vy += .22;
  state.airY += state.vy;
  if (state.vy <= 0) return;
  for (let row = floors.length - 1; row >= 0; row--) {
    if (previous <= floors[row] && state.airY >= floors[row] && overBeam(state.x, row)) {
      state.row = row;
      state.airY = null;
      state.vy = 0;
      state.coyoteUntil = -1;
      if (state.bufferUntil >= state.ticks) launch();
      break;
    }
  }
}

export const kong: Game<KongState> = {
  create(seed, difficulty, version = gameVersion) {
    return {
      score: 0, ticks: 0, status: "playing", seed, difficulty,
      x: 39, row: 0, version, airY: null, vy: 0, coyoteUntil: -1, bufferUntil: -1, jumps: 0, climb: 0, climbTo: 0, jump: 0, previous: 0,
      lives: difficulty === "HARD" ? 2 : 3, invincibleUntil: 0, combUntil: 0, combUsed: false, hazards: [],
    };
  },
  step(state, input) {
    if (state.status !== "playing") return;
    state.ticks++;
    const pressed = input & ~state.previous;
    state.previous = input;
    const horizontal = Number(Boolean(input & RIGHT)) - Number(Boolean(input & LEFT));
    const vertical = Number(Boolean(input & UP)) - Number(Boolean(input & DOWN));
    if (state.version === 2) legacyMovement(state, pressed, horizontal, vertical);
    else polishedMovement(state, pressed, horizontal, vertical);
    if ((pressed & B) && !state.combUsed && !state.climb && state.row === comb.row && Math.abs(state.x - comb.x) < 12) {
      state.combUntil = state.ticks + 300;
      state.combUsed = true;
    }
    const interval = state.difficulty === "EASY" ? 290 : state.difficulty === "MEDIUM" ? 135 : 95;
    if (state.ticks % interval === 0 && (state.difficulty !== "EASY" || !state.hazards.length)) addHazard(state);
    if (state.difficulty === "HARD" && state.ticks % 151 === 45) addHazard(state, true);
    stepHazards(state);
    if (state.status !== "playing") return;
    if (state.row === 4 && state.airY === null && !state.climb && Math.abs(state.x - goal) < 10) {
      state.status = "won";
      state.score = Math.min(350, state.score + 150);
    } else if (state.ticks >= roundSeconds("ESCALADA_KONG", state.difficulty) * 60) state.status = "lost";
  },
  draw(ctx, state) {
    const rect = (x: number, y: number, w: number, h: number, color: string) => {
      ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), w, h);
    };
    rect(0, 0, 240, 160, "#231a35");
    floors.forEach((y, row) => {
      rect(16 + row * 2, y + 1, 207 - row * 4, 4, "#b27a79");
      for (let x = 24; x < 215; x += 12) rect(x, y + 2, 5, 2, "#e7a786");
    });
    ladders.forEach((x, row) => {
      for (const side of [-4, 4]) rect(x + side, floors[row + 1] + 4, 2, 24, "#71c6bb");
      for (let y = floors[row + 1] + 7; y < floors[row]; y += 5) rect(x - 3, y, 8, 2, "#71c6bb");
    });
    // Original shaggy customer, wooden shelving and grooming tools.
    rect(34, 12, 24, 17, "#8e513e"); rect(40, 7, 15, 13, "#df9a70");
    rect(36, 8, 6, 13, "#56312d"); rect(46, 19, 14, 8, "#56312d"); rect(50, 12, 2, 2, "#231a35");
    rect(goal - 5, 21, 11, 2, "#ffd776"); rect(goal - 5, 25, 11, 2, "#ffd776");
    rect(goal - 5, 20, 2, 7, "#ffd776"); rect(goal + 4, 22, 2, 4, "#fff0af");
    if (!state.combUsed) {
      rect(comb.x - 6, floors[comb.row] - 7, 12, 2, "#f5ce67");
      for (let x = comb.x - 6; x < comb.x + 6; x += 3) rect(x, floors[comb.row] - 5, 2, 4, "#f5ce67");
    }
    for (const hazard of state.hazards) {
      const bounce = state.difficulty === "HARD" && hazard.kind === "jar" && Math.floor((state.ticks + hazard.row * 6) / 7) % 4 === 1 ? 4 : 0;
      const y = floors[hazard.row] - 7 - bounce;
      rect(hazard.x - 4, y, 8, 7, hazard.kind === "jar" ? "#e88253" : "#ec668c");
      rect(hazard.x - 3, y, 6, 2, "#ffca89");
      if (hazard.kind === "lotion" && Math.floor(state.ticks / 5) % 2) rect(hazard.x, y - 3, 2, 3, "#ffcf67");
    }
    const y = heightAt(state);
    if (state.invincibleUntil <= state.ticks || Math.floor(state.ticks / 4) % 2 === 0) {
      rect(state.x - 4, y - 12, 8, 5, "#ffd29b");
      rect(state.x - 4, y - 7, 8, 7, state.combUntil > state.ticks ? "#ffdb69" : "#6ae0ca");
      rect(state.x - 4, y - 13, 8, 2, "#664b60");
    }
    ctx.font = "bold 8px monospace"; ctx.textAlign = "left"; ctx.fillStyle = "#ffedcc";
    ctx.fillText(`VIDAS ${state.lives}${state.combUntil > state.ticks ? "  PENTE!" : ""}`, 155, 11);
  },
};
