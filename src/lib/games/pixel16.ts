import { boardWidth, boardSize, cellInputShift, createBoard, matchSwap, neighbors, settleBoard } from "./salon-match";
import { nextSeed } from "./random";
import { A, DOWN, LEFT, RIGHT, UP, roundSeconds, type Difficulty, type Game, type GameCode, type GameState } from "./types";

type Mode = "blaster" | "bounce" | "orbit" | "ruins" | "jewels" | "stack";
type BoardEffect = {
  before: number[]; swapped: number[]; from: number; to: number;
  matches: Set<number>; start: number; end: number;
};
type State = GameState & {
  revised: boolean; version: number; polished: Set<number>; boostUntil: number; effect?: BoardEffect; board: number[]; selected: number; message: string; collected: number; facing: number; moving: boolean;
  difficulty: Difficulty; limit: number; seed: number; input: number;
  x: number; y: number; vx: number; vy: number; wave: number; flash: number;
  cooldown: number; lives: number; pieces: Piece[]; shots: Piece[];
  stack: { x: number; width: number }[];
  drop?: { x: number; start: number };
};
type Piece = { x: number; y: number; kind: number };
const colors = ["#70ead6", "#ffbc69", "#ef81ae", "#9e9bff", "#d6eb93"];
const themes: Record<Mode, [string, string, string]> = {
  blaster: ["#151b36", "#293b61", "#67eed7"], bounce: ["#29192d", "#523554", "#ffab77"],
  orbit: ["#10162e", "#272851", "#a7bbff"], ruins: ["#22202f", "#444442", "#e2c078"],
  jewels: ["#22203e", "#41375e", "#f58fc7"], stack: ["#132436", "#243d58", "#85ddae"],
};
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
function random(state: State, limit: number) {
  state.seed = nextSeed(state.seed);
  return (state.seed >>> 12) % limit;
}
function award(state: State, value: number) {
  state.score += value;
  state.flash = state.ticks + 14;
}
function hurt(state: State) {
  if (state.ticks < state.cooldown) return;
  state.cooldown = state.ticks + 65;
  state.lives--;
  if (!state.lives) state.status = "lost";
}
function overlap(a: Piece, b: Piece, distance: number) {
  return Math.abs(a.x - b.x) < distance && Math.abs(a.y - b.y) < distance;
}

function shooter(state: State, input: number, fire: boolean, space: boolean) {
  state.x = clamp(state.x + (Number(Boolean(input & RIGHT)) - Number(Boolean(input & LEFT))) * 2, 12, 228);
  state.y = clamp(state.y + (Number(Boolean(input & DOWN)) - Number(Boolean(input & UP))) * 2, 35, 144);
  if (fire || ((input & A) && state.ticks % 15 === 0)) {
    state.shots.push({ x: state.x, y: state.y - 7, kind: 0 });
    if (!space) {
      state.shots.push({ x: state.x - 5, y: state.y - 5, kind: -1 }, { x: state.x + 5, y: state.y - 5, kind: 1 });
    }
  }
  const rate = (state.difficulty === "HARD" ? 26 : state.difficulty === "MEDIUM" ? 34 : 44) - Math.min(10, state.wave * 2);
  if (state.ticks % rate === 1) state.pieces.push({ x: 16 + random(state, 208), y: 23, kind: random(state, 3) });
  for (const shot of state.shots) { shot.y -= 5; shot.x += shot.kind; }
  for (const enemy of state.pieces) {
    enemy.y += (space ? 1.1 : .8) + state.wave * .13;
    enemy.x = clamp(enemy.x + (space && enemy.kind === 1 ? (Math.floor(state.ticks / 18) % 2 ? 1 : -1) : 0), 10, 230);
    const hit = state.shots.find(shot => overlap(shot, enemy, 9));
    if (hit) {
      hit.y = -20;
      enemy.y = 170;
      award(state, enemy.kind === 2 ? 20 : 10);
    } else if (overlap(enemy, { x: state.x, y: state.y, kind: 0 }, 10)) {
      hurt(state);
      enemy.y = 170;
    }
  }
  state.pieces = state.pieces.filter(piece => piece.y < 160);
  state.shots = state.shots.filter(shot => shot.y > 16);
}

function bounce(state: State, input: number, pressed: boolean) {
  if (state.revised) {
    state.vx = (Number(Boolean(input & RIGHT)) - Number(Boolean(input & LEFT))) * 2.8;
  } else state.vx = clamp(state.vx * .93 + (Number(Boolean(input & RIGHT)) - Number(Boolean(input & LEFT))) * .25, -3, 3);
  state.x += state.vx;
  if (state.x < 10 || state.x > 230) state.vx *= -1;
  state.x = clamp(state.x, 10, 230);
  state.vy += .21;
  if (state.revised && (input & A) && state.vy > 0 && state.y >= 119) {
    state.vy = -6.4;
    state.jumps = (state.jumps ?? 0) + 1;
  } else if (!state.revised && pressed && state.y > 80 && state.vy > 0) state.vy = -5.6;
  state.y += state.vy;
  if (state.y > 142) {
    if (Math.abs(state.x - (120 + Math.round(Math.sin(state.ticks / 36) * 65))) < 19) hurt(state);
    state.y = 142;
    state.vy = -4.9 - state.wave * .25;
  }
  if (state.y < 25) { state.y = 25; state.vy = 1; }
  if (state.version >= 8) {
    state.pieces = state.pieces.filter(piece => {
      if (!overlap(piece, { x: state.x, y: state.y, kind: 0 }, 12)) return true;
      state.collected++;
      award(state, 15);
      return false;
    });
    if (!state.pieces.length && Math.abs(state.x - 215) < 15 && Math.abs(state.y - 120) < 18) {
      award(state, 30);
      state.status = "won";
    }
    state.message = state.pieces.length ? `AROS ${state.collected}/4` : "SIGA PARA A SAÍDA";
    return;
  }
  for (const piece of state.pieces) {
    if (!overlap(piece, { x: state.x, y: state.y, kind: 0 }, 10)) continue;
    award(state, 15);
    piece.x = 16 + random(state, 208);
    piece.y = 50 + random(state, 76);
  }
}

function puzzle(state: State, input: number, pressed: boolean, match: boolean) {
  const X = 12;
  const Y = 7;
  const horizontal = Number(Boolean(input & RIGHT)) - Number(Boolean(input & LEFT));
  const vertical = Number(Boolean(input & DOWN)) - Number(Boolean(input & UP));
  if (state.ticks % 7 === 1 || (input & 15) !== (state.input & 15)) {
    const x = clamp(state.x + horizontal, 0, X - 1);
    const y = clamp(state.y + (horizontal ? 0 : vertical), 0, Y - 1);
    const wall = !match && state.pieces.some(piece => piece.kind === 4 && piece.x === x && piece.y === y);
    if (!wall) { state.x = x; state.y = y; }
  }
  const piece = state.pieces.find(cell => cell.x === state.x && cell.y === state.y);
  if (!match && pressed && state.ticks >= state.cooldown) {
    const wall = state.pieces.find(cell => cell.kind === 4 && Math.abs(cell.x - state.x) + Math.abs(cell.y - state.y) === 1);
    if (wall) {
      state.pieces = state.pieces.filter(cell => cell !== wall);
      state.cooldown = state.ticks + 25;
    }
  }
  if (!piece) return;
  if (!match) {
    if (piece.kind < 4) {
      award(state, 20);
      state.pieces = state.pieces.filter(cell => cell !== piece);
    }
    return;
  }
  if (!pressed) return;
  const group = new Set([piece]);
  for (const member of group) {
    for (const cell of state.pieces) {
      if (cell.kind === piece.kind && Math.abs(cell.x - member.x) + Math.abs(cell.y - member.y) === 1) group.add(cell);
    }
  }
  if (group.size < 3) { piece.kind = (piece.kind + 1) % 4; return; }
  award(state, group.size * 8);
  for (const cell of group) cell.kind = random(state, 4);
}

function moveGrid(state: State, input: number) {
  const movement = input & 15;
  if (!movement || (state.ticks % 8 !== 1 && movement === (state.input & 15))) return [state.x, state.y];
  const dx = Number(Boolean(input & RIGHT)) - Number(Boolean(input & LEFT));
  const dy = Number(Boolean(input & DOWN)) - Number(Boolean(input & UP));
  return [clamp(state.x + dx, 0, 11), clamp(state.y + (dx ? 0 : dy), 0, 6)];
}

function polishGoal(difficulty: Difficulty) {
  return difficulty === "HARD" ? 24 : difficulty === "MEDIUM" ? 18 : 12;
}

function matchItems(state: State, input: number, pressed: boolean) {
  if (state.effect && state.ticks < state.effect.end) return;
  state.effect = undefined;
  const tapped = (input >> cellInputShift) - 1;
  const priorTap = (state.input >> cellInputShift) - 1;
  if (tapped >= 0 && tapped < boardSize && tapped !== priorTap) {
    state.x = tapped % boardWidth;
    state.y = Math.floor(tapped / boardWidth);
  } else {
    [state.x, state.y] = moveGrid(state, input);
    if (!pressed) return;
  }
  const current = state.y * boardWidth + state.x;
  if (state.selected === current) {
    state.selected = -1;
    state.message = "ESCOLHA UM ITEM";
    return;
  }
  if (state.selected < 0) {
    state.selected = current;
    state.message = "ESCOLHA UM VIZINHO";
    return;
  }
  const from = state.selected;
  if (state.version >= 8 && (state.limit - state.ticks <= 32 || !neighbors(from, current))) {
    state.message = state.limit - state.ticks <= 32 ? "TEMPO QUASE NO FIM" : "ESCOLHA UM VIZINHO";
    return;
  }
  const before = state.version >= 8 ? [...state.board] : [];
  const matched = matchSwap(state.board, from, current);
  if (state.version >= 8 && matched.size) {
    for (const cell of matched) state.polished.add(cell);
    state.effect = { before, swapped: [...state.board], from, to: current, matches: matched,
      start: state.ticks, end: state.ticks + 32 };
  }
  if (!matched.size) {
    state.message = "PRECISA FORMAR 3 EM LINHA";
    return;
  }
  state.selected = -1;
  state.seed = nextSeed(state.seed);
  const settled = settleBoard(state.board, matched, state.seed);
  state.board = settled.board;
  award(state, settled.count * 8);
  state.message = `COMBO DE ${settled.count} ITENS!`;
}

const ruinMap = [
  "############",
  "#..#..K...E#",
  "#.##.##.##.#",
  "#K...#.....#",
  "#.##...##.##",
  "#S...K....K#",
  "############",
];

function explorer(state: State, input: number) {
  const [x, y] = moveGrid(state, input);
  if (ruinMap[y][x] !== "#") {
    state.moving = x !== state.x || y !== state.y;
    if (x !== state.x) state.facing = x > state.x ? 1 : -1;
    if (state.moving) state.flash = Math.max(state.flash, state.ticks + 3);
    state.x = x;
    state.y = y;
  }
  const key = state.pieces.find(piece => piece.kind === 1 && piece.x === state.x && piece.y === state.y);
  if (key) {
    state.pieces = state.pieces.filter(piece => piece !== key);
    state.collected++;
    award(state, 45);
  }
  const exit = ruinMap[state.y][state.x] === "E";
  if (exit && state.collected === 4) {
    award(state, 70);
    state.status = "won";
  }
  for (const guard of state.pieces.filter(piece => piece.kind === 5)) {
    if (state.ticks % 18 === 0) guard.x = guard.x >= 9 ? 3 : guard.x + 1;
    if (guard.x === state.x && guard.y === state.y) {
      const before = state.lives;
      hurt(state);
      if (state.lives !== before) { state.x = 1; state.y = 5; }
    }
  }
  state.message = exit && state.collected < 4 ? "PORTAO TRANCADO" : `CHAVES ${state.collected}/4  >  SAIDA`;
}

function orbitFlight(state: State, input: number, pressed: boolean) {
  const dx = Number(Boolean(input & RIGHT)) - Number(Boolean(input & LEFT));
  const dy = Number(Boolean(input & DOWN)) - Number(Boolean(input & UP));
  state.x = clamp(state.x + dx * 2, 12, 220);
  state.y = clamp(state.y + dy * 2.2, 27, 148);
  if (pressed || ((input & A) && state.ticks % 11 === 0)) {
    state.shots.push({ x: state.x + 9, y: state.y, kind: 0 });
    if (state.version >= 9 && state.ticks < state.boostUntil) {
      state.shots.push({ x: state.x + 7, y: state.y - 6, kind: -1 }, { x: state.x + 7, y: state.y + 6, kind: 1 });
    }
  }
  const gap = Math.max(17, (state.difficulty === "HARD" ? 29 : 44) - state.wave * 4);
  if (state.ticks % gap === 1) state.pieces.push({ x: 244, y: 28 + random(state, 115), kind: random(state, 3) });
  if (state.version >= 9 && state.ticks % 480 === 240) {
    state.pieces.push({ x: 238, y: 34 + random(state, 105), kind: 4 });
  }
  for (const shot of state.shots) {
    shot.x += 6;
    shot.y += shot.kind * .5;
  }
  for (const enemy of state.pieces) {
    enemy.x -= (enemy.kind === 1 ? 2.5 : 1.6) + state.wave * .15;
    if (enemy.kind === 4) {
      if (overlap(enemy, { x: state.x, y: state.y, kind: 0 }, 12)) {
        state.boostUntil = state.ticks + 480;
        enemy.x = -20;
      }
      continue;
    }
    if (enemy.kind === 2) enemy.y = clamp(enemy.y + (Math.floor(state.ticks / 20) % 2 ? 1 : -1), 25, 148);
    const hit = state.shots.find(shot => overlap(shot, enemy, 10));
    if (hit) {
      hit.x = 280;
      enemy.x = -20;
      award(state, enemy.kind === 2 ? 20 : 10);
    } else if (overlap(enemy, { x: state.x, y: state.y, kind: 0 }, 11)) {
      hurt(state);
      enemy.x = -20;
    }
  }
  state.pieces = state.pieces.filter(piece => piece.x > -14);
  state.shots = state.shots.filter(shot => shot.x < 246 && (state.version < 9 || (shot.y > 17 && shot.y < 160)));
}

function stacking(state: State, pressed: boolean) {
  const top = state.stack.at(-1)!;
  if (state.drop) {
    if (state.ticks - state.drop.start < 15) return;
    state.x = state.drop.x;
    state.drop = undefined;
  } else {
    state.x += state.vx * (1 + state.wave * .2);
    if (state.x < 14 || state.x + top.width > 226) state.vx *= -1;
    state.x = clamp(state.x, 14, 226 - top.width);
    if (!pressed) return;
    if (state.version >= 8) {
      if (state.ticks + 15 < state.limit) state.drop = { x: Math.round(state.x), start: state.ticks };
      return;
    }
  }
  const left = Math.max(top.x, Math.round(state.x));
  const right = Math.min(top.x + top.width, Math.round(state.x) + top.width);
  if (right - left < 5) {
    hurt(state);
  } else {
    const perfect = Math.abs(state.x - top.x) <= 4;
    state.stack.push(perfect ? { ...top } : { x: left, width: right - left });
    if (state.stack.length > 10) state.stack.shift();
    award(state, perfect ? 30 : 15);
  }
  state.x = 14;
  state.vx = Math.abs(state.vx);
}

function makeGame(mode: Mode, code: GameCode, cap: number): Game<State> {
  return {
    create(seed, difficulty, version = 6) {
      const state: State = {
        revised: version >= 6, version, polished: new Set(), boostUntil: 0, board: [], selected: -1, message: "", collected: 0, facing: 1, moving: false,
        seed, difficulty, limit: roundSeconds(code, difficulty) * 60,
        status: "playing", score: 0, ticks: 0, input: 0, x: 120, y: 128, vx: 2, vy: 0, wave: 0, flash: 0,
        lives: difficulty === "HARD" ? 2 : 3, cooldown: 0, pieces: [], shots: [], stack: [{ x: 89, width: 62 }],
      };
      if (mode === "bounce") state.pieces = Array.from({ length: 4 }, (_, kind) => ({ x: 30 + kind * 60, y: 60 + random(state, 62), kind }));
      if (mode === "jewels" || mode === "ruins") {
        state.x = 0; state.y = 3;
        state.pieces = Array.from({ length: 84 }, (_, cell) => ({ x: cell % 12, y: Math.floor(cell / 12), kind: random(state, 4) }));
        if (mode === "ruins") state.pieces = state.pieces.filter(({ x, y }) => {
          if (!x || y === 3) return false;
          return (x % 3 === 0 && y % 3 !== 0) || random(state, 4) === 0;
        }).map(piece => ({ ...piece, kind: piece.x % 3 === 0 && piece.y % 3 !== 0 ? 4 : piece.kind }));
        else {
          const first = state.pieces[36].kind;
          state.pieces[37].kind = first;
          state.pieces[38].kind = first;
        }
      }
      if (state.revised) {
        if (mode === "jewels") { state.board = createBoard(seed); state.message = "ESCOLHA UM ITEM"; }
        if (mode === "ruins") {
          state.x = 1;
          state.y = 5;
          state.pieces = ruinMap.flatMap((row, y) => [...row].flatMap((cell, x) => cell === "K" ? [{ x, y, kind: 1 }] : []));
          state.pieces.push({ x: 3, y: 5, kind: 5 });
        }
        if (mode === "orbit") { state.x = 26; state.y = 80; }
        if (mode === "bounce") {
          state.vx = 0;
          state.vy = -4.9;
          if (version >= 8) state.pieces = [{ x: 51, y: 104, kind: 0 }, { x: 95, y: 67, kind: 1 },
            { x: 145, y: 102, kind: 2 }, { x: 196, y: 76, kind: 3 }];
        }
      }
      return state;
    },
    step(state, input) {
      state.ticks++;
      const pressed = Boolean((input & A) && !(state.input & A));
      state.wave = Math.floor(state.ticks / 600);
      const oldX = state.x;
      const oldY = state.y;
      if (mode === "orbit" && state.revised) orbitFlight(state, input, pressed);
      else if (mode === "blaster" || mode === "orbit") shooter(state, input, pressed, mode === "orbit");
      if (mode === "bounce") bounce(state, input, pressed);
      if (state.revised && mode === "ruins") explorer(state, input);
      else if (state.revised && mode === "jewels") matchItems(state, input, pressed);
      else if (mode === "ruins" || mode === "jewels") puzzle(state, input, pressed, mode === "jewels");
      if (mode === "blaster") {
        state.moving = oldX !== state.x || oldY !== state.y;
        if (oldX !== state.x) state.facing = state.x > oldX ? 1 : -1;
      }
      if (mode === "stack") stacking(state, pressed);
      state.input = input;
      state.score = Math.min(cap, state.score);
      if (state.status === "playing") {
        const boardGoal = mode === "jewels" && state.version >= 8;
        if ((boardGoal && state.polished.size >= polishGoal(state.difficulty) && !state.effect) ||
            (!boardGoal && state.score >= cap && !state.effect) || (mode === "ruins" && !state.revised && !state.pieces.some(piece => piece.kind < 4))) state.status = "won";
        else if (state.ticks >= state.limit) state.status = "lost";
      }
    },
    draw(ctx, state, avatar) { draw(ctx, state, mode, avatar); },
  };
}

function draw(ctx: CanvasRenderingContext2D, s: State, mode: Mode, avatar?: CanvasImageSource) {
  const [sky, floor, light] = themes[mode];
  const rect = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), w, h);
  };
  const gem = (x: number, y: number, color: string) => {
    rect(x-6,y-3,12,8,"#100e20"); rect(x-4,y-5,8,12,"#100e20");
    rect(x-5,y-2,10,6,color); rect(x-3,y-4,6,10,color);
    rect(x-3,y-3,3,2,"#fff0cf"); rect(x+1,y+2,3,2,"#ffffff40");
  };
  const hero = (x: number, y: number) => {
    const bounce = s.moving ? Math.floor(s.ticks / 4) % 2 * 2 : 0;
    rect(x-8,y+7,16,3,"#080b18aa");
    if (avatar) {
      ctx.save();
      ctx.translate(Math.round(x), Math.round(y - bounce));
      ctx.scale(s.facing, 1);
      ctx.drawImage(avatar, -8, -17, 16, 32);
      ctx.restore();
    } else { rect(x-6,y-6,12,14,light); rect(x-3,y-4,6,4,"#fff0cf"); }
  };
  const tool = (x: number, y: number, kind: number) => {
    const c = colors[kind];
    if (kind === 0) {
      rect(x-5,y-5,3,4,c); rect(x-5,y+2,3,4,c);
      ctx.strokeStyle = c;
      ctx.beginPath(); ctx.moveTo(x-2,y-2); ctx.lineTo(x+5,y+4);
      ctx.moveTo(x-2,y+3); ctx.lineTo(x+5,y-5); ctx.stroke();
    } else if (kind === 1) {
      rect(x-6,y-4,12,3,c);
      for (let i = -6; i <= 4; i += 3) rect(x+i,y-1,2,6,c);
    } else if (kind === 2) {
      rect(x-6,y-4,12,3,"#fff0cf"); rect(x-5,y-1,10,6,c); rect(x-3,y+1,6,2,"#972e50");
    } else if (kind === 3) {
      rect(x-6,y-5,12,4,c); rect(x-2,y-1,4,7,c); rect(x-5,y-5,10,1,"#fff0cf");
    } else {
      rect(x-5,y-5,10,6,c); rect(x-4,y-5,8,2,"#fff0cf"); rect(x-2,y+1,4,6,c);
    }
  };
  rect(0,0,240,160,sky);
  if (mode === "orbit") {
    for (let i = 0; i < 44; i++) {
      const y = 20 + (i * 31) % 137;
      const x = (240 + (i * 53 - Math.floor(s.ticks / (i % 4 + 1))) % 240) % 240;
      rect(x, y, i % 4 === 0 ? 2 : 1, 1, i % 3 === 0 ? light : floor);
    }
  } else if (mode === "stack") {
    for (let x = 0; x < 240; x += 20) {
      const top = 78 + (x * 13) % 56;
      rect(x, top, 17, 160 - top, floor);
      for (let y = top + 5; y < 154; y += 8) rect(x + 3, y, 4, 2, "#54707c");
    }
  } else if (mode === "blaster") {
    for (let y = 24; y < 160; y += 16) {
      rect(8, y, 224, 1, floor);
      rect(5, y + 3, 3, 5, light);
      rect(232, y + 3, 3, 5, light);
    }
    rect(8, 18, 1, 142, floor);
    rect(231, 18, 1, 142, floor);
  } else if (mode === "bounce") {
    for (let x = 0; x < 240; x += 24) {
      const y = 30 + x % 17;
      rect(x, y, 19, 4, floor);
      rect(x + 5, y - 3, 11, 3, floor);
    }
    rect(0, 151, 240, 9, floor);
  }
  if (s.revised && mode === "jewels") {
    const effect = s.effect;
    const age = effect ? s.ticks - effect.start : 0;
    const position = (cell: number) => [13 + cell % boardWidth * 18, 22 + Math.floor(cell / boardWidth) * 18];
    const board = effect && age < 9 ? effect.before : effect && age < 23 ? effect.swapped : s.board;
    board.forEach((kind, cell) => {
      const [x, y] = position(cell);
      const matched = effect && age >= 9 && age < 23 && effect.matches.has(cell);
      const polished = s.polished.has(cell) && !(effect && age < 9 && effect.matches.has(cell));
      rect(x, y, 17, 17, matched ? "#a98249" : cell === s.selected ? "#61535f" : polished ? "#6a533b" : floor);
      if (polished) rect(x + 1, y + 1, 15, 1, "#ac875c");
      if (effect && age < 9 && (cell === effect.from || cell === effect.to)) return;
      const rise = effect && age >= 23 && (effect.matches.has(cell) || kind !== effect.swapped[cell])
        ? Math.round((32 - age) * .65) : 0;
      ctx.save();
      ctx.beginPath(); ctx.rect(x, y, 17, 17); ctx.clip();
      tool(x + 8, y + 8 - rise, kind);
      ctx.restore();
      if (matched) {
        ctx.strokeStyle = "#ffe99d";
        ctx.strokeRect(x + .5, y + .5, 16, 16);
      }
    });
    if (effect && age < 9) {
      for (const [from, to] of [[effect.from, effect.to], [effect.to, effect.from]]) {
        const [x, y] = position(from);
        const [targetX, targetY] = position(to);
        const ratio = age / 9;
        tool(x + 8 + (targetX - x) * ratio, y + 8 + (targetY - y) * ratio, effect.before[from]);
      }
    } else if (!effect) {
      ctx.strokeStyle = s.selected < 0 ? light : "#ffe99d";
      ctx.strokeRect(13.5 + s.x * 18, 22.5 + s.y * 18, 16, 16);
    }
  } else if (s.revised && mode === "ruins") {
    ruinMap.forEach((row, y) => [...row].forEach((cell, x) => {
      const px = 13 + x * 18;
      const py = 22 + y * 18;
      rect(px, py, 17, 17, cell === "#" ? "#66545b" : floor);
      if (cell === "#") rect(px + 1, py + 1, 15, 3, "#87726d");
      if (cell === "E") {
        rect(px + 2, py + 1, 13, 15, s.collected === 4 ? "#78dba5" : "#bb795a");
        rect(px + 4, py + 3, 9, 12, sky);
      }
    }));
    for (const p of s.pieces) {
      const x = 21 + p.x * 18;
      const y = 30 + p.y * 18;
      if (p.kind === 5) {
        rect(x - 6, y - 5, 12, 10, "#dd6574");
        rect(x - 4, y - 2, 8, 2, "#ffebce");
      } else {
        rect(x - 6, y - 3, 6, 6, "#ffd37d");
        rect(x - 4, y - 1, 2, 2, sky);
        rect(x, y, 6, 2, "#ffd37d");
        rect(x + 4, y, 2, 4, "#ffd37d");
      }
    }
    hero(21 + s.x * 18, 32 + s.y * 18);
  } else if (mode === "jewels" || mode === "ruins") {
    for (let y=0;y<7;y++) for (let x=0;x<12;x++) rect(13+x*18,22+y*18,17,17,floor);
    for (const p of s.pieces) {
      const x=21+p.x*18, y=30+p.y*18;
      if (p.kind === 4) { rect(x-8,y-8,16,16,"#191926"); rect(x-7,y-7,14,11,"#77716c"); rect(x-6,y-6,12,2,"#a19a86"); }
      else gem(x,y,colors[p.kind]);
    }
    if (mode === "ruins") hero(21+s.x*18,32+s.y*18);
    else {
      ctx.strokeStyle=light;
      ctx.strokeRect(12.5+s.x*18,21.5+s.y*18,18,18);
      hero(229,145);
    }
  } else if (mode === "stack") {
    const brick = (x: number, y: number, width: number, color: string) => {
      rect(x,y,width,10,color); rect(x,y,width,2,"#ffffff55"); rect(x,y+8,width,2,"#00000055");
      for(let offset=4;offset<width-3;offset+=8) rect(x+offset,y+4,3,3,sky);
    };
    s.stack.forEach((p,i)=>brick(p.x,147-i*10,p.width,colors[i%4]));
    const top=s.stack.at(-1)!;
    const landingY = 147 - s.stack.length * 10;
    const releaseY = Math.max(23, landingY - 44);
    const hangingY = s.version < 8 ? landingY : s.drop
      ? releaseY + (landingY - releaseY) * Math.min(1, (s.ticks - s.drop.start) / 15)
      : releaseY;
    if (s.version >= 8) {
      const cableX = Math.round(s.x + top.width / 2);
      rect(cableX - 4, 20, 9, 4, "#b49467");
      if (!s.drop) rect(cableX, 24, 1, Math.max(0, hangingY - 24), "#c9c3a8");
      rect(top.x, landingY, 1, 11, "#fbe49d");
      rect(top.x + top.width - 1, landingY, 1, 11, "#fbe49d");
    }
    brick(Math.round(s.x),hangingY,top.width,light);
    if (!s.revised) hero(220,138);
  } else if (mode === "orbit" && s.revised) {
    for (const enemy of s.pieces) {
      if (enemy.kind === 4) { gem(enemy.x, enemy.y, "#72efbc"); continue; }
      rect(enemy.x - 5, enemy.y - 6, 10, 12, colors[enemy.kind]);
      rect(enemy.x - 9, enemy.y - 2, 11, 4, "#443151");
      rect(enemy.x - 3, enemy.y, 4, 2, "#ffebce");
    }
    s.shots.forEach(shot => rect(shot.x, shot.y - 1, 8, 3, light));
    if (s.ticks >= s.cooldown || Math.floor(s.ticks / 5) % 2 === 0) {
      const { x, y } = s;
      rect(x - 13 - s.ticks % 4, y - 2, 6 + s.ticks % 4, 4, "#fb9c69");
      rect(x - 8, y - 7, 10, 14, "#644593");
      rect(x - 8, y - 3, 19, 6, "#b7b4e6");
      rect(x + 1, y - 3, 6, 3, "#67eed7");
      rect(x + 8, y - 1, 6, 3, "#e5e9ff");
    }
  } else {
    if (mode === "bounce") {
      const hazard=120+Math.round(Math.sin(s.ticks/36)*65);
      rect(hazard-16,149,32,5,"#e35f77");
      for (let i=-15;i<16;i+=6) rect(hazard+i,145,4,4,"#ffa18c");
      if (s.version >= 8) {
        for (const p of s.pieces) {
          const color = colors[p.kind];
          rect(p.x - 4, p.y - 8, 8, 2, color);
          rect(p.x - 7, p.y - 5, 2, 10, color);
          rect(p.x + 5, p.y - 5, 2, 10, color);
          rect(p.x - 4, p.y + 6, 8, 2, color);
          rect(p.x - 2, p.y - 8, 4, 1, "#fff0c9");
        }
        if (!s.pieces.length) {
          rect(201, 103, 27, 36, "#75c6a2");
          rect(204, 107, 21, 32, sky);
          rect(214, 115, 4, 12, "#9af1b9");
        }
      } else s.pieces.forEach(p=>gem(p.x,p.y,colors[p.kind]));
      rect(s.x-8,s.y-8,16,16,light);
      rect(s.x-5,s.y-6,10,3,"#fff0cf");
    } else {
      for(const p of s.pieces){
        rect(p.x-7,p.y-4,14,8,floor); rect(p.x-4,p.y-7,8,14,colors[p.kind]);
        rect(p.x-6,p.y-1,12,3,"#ffefcb");
      }
      s.shots.forEach(p=>rect(p.x-1,p.y,3,6,light));
      if(mode==="orbit"){
        rect(s.x-12,s.y+1,24,6,light);
        rect(s.x-6,s.y-6,12,14,floor);
      }
    }
    if (!(s.revised && mode === "bounce") && (s.ticks >= s.cooldown || Math.floor(s.ticks / 5) % 2 === 0)) hero(s.x,s.y);
  }
  rect(0,0,240,17,"#101522");
  ctx.fillStyle = s.flash > s.ticks ? "#fff1ba" : light;
  ctx.font = "bold 9px monospace"; ctx.textAlign = "left";
  ctx.fillText((s.effect && s.ticks - s.effect.start < 9 ? "TROCANDO ITENS..." : s.message) || `FASE ${s.wave+1}  ·  ${s.score} PTS`,8,12);
  ctx.textAlign = "right";
  if (mode === "jewels" && s.version >= 8) ctx.fillText(`${s.polished.size}/${polishGoal(s.difficulty)} CASAS`,232,12);
  else if (mode === "orbit" && s.ticks < s.boostUntil) ctx.fillText("LASER TRIPLO",232,12);
  else if (!(s.revised && mode === "jewels")) ctx.fillText(`${s.lives} VIDAS`,232,12);
}

export const pixel16 = {
  NAVALHA_RUSH: makeGame("blaster", "NAVALHA_RUSH", 400),
  ESCALADA_KONG: makeGame("bounce", "ESCALADA_KONG", 350),
  ORBITA_PIXEL: makeGame("orbit", "ORBITA_PIXEL", 400),
  BARBA_FIGHTER: makeGame("ruins", "BARBA_FIGHTER", 400),
  BARBER_VALLEY: makeGame("jewels", "BARBER_VALLEY", 450),
  TORRE_FADE: makeGame("stack", "TORRE_FADE", 250),
};
