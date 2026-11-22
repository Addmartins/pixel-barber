import { nextSeed } from "./random";
import { A, DOWN, LEFT, RIGHT, UP, roundSeconds, type Difficulty, type Game, type GameCode, type GameState } from "./types";

type Mode = "blaster" | "bounce" | "orbit" | "ruins" | "jewels" | "stack";
type State = GameState & {
  difficulty: Difficulty; limit: number; seed: number; input: number;
  x: number; y: number; vx: number; vy: number; wave: number; flash: number;
  cooldown: number; lives: number; pieces: Piece[]; shots: Piece[];
  stack: { x: number; width: number }[];
};
type Piece = { x: number; y: number; kind: number };
const colors = ["#70ead6", "#ffbc69", "#ef81ae", "#9e9bff"];
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
  state.vx = clamp(state.vx * .93 + (Number(Boolean(input & RIGHT)) - Number(Boolean(input & LEFT))) * .25, -3, 3);
  state.x += state.vx;
  if (state.x < 10 || state.x > 230) state.vx *= -1;
  state.x = clamp(state.x, 10, 230);
  state.vy += .21;
  if (pressed && state.y > 80 && state.vy > 0) state.vy = -5.6;
  state.y += state.vy;
  if (state.y > 142) {
    if (Math.abs(state.x - (120 + Math.round(Math.sin(state.ticks / 36) * 65))) < 19) hurt(state);
    state.y = 142;
    state.vy = -4.9 - state.wave * .25;
  }
  if (state.y < 25) { state.y = 25; state.vy = 1; }
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
  if (group.size < 3) { piece.kind = (piece.kind + 1) % colors.length; return; }
  award(state, group.size * 8);
  for (const cell of group) cell.kind = random(state, colors.length);
}

function stacking(state: State, pressed: boolean) {
  const top = state.stack.at(-1)!;
  state.x += state.vx * (1 + state.wave * .2);
  if (state.x < 14 || state.x + top.width > 226) state.vx *= -1;
  state.x = clamp(state.x, 14, 226 - top.width);
  if (!pressed) return;
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
    create(seed, difficulty) {
      const state: State = {
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
      return state;
    },
    step(state, input) {
      state.ticks++;
      const pressed = Boolean((input & A) && !(state.input & A));
      state.wave = Math.floor(state.ticks / 600);
      if (mode === "blaster" || mode === "orbit") shooter(state, input, pressed, mode === "orbit");
      if (mode === "bounce") bounce(state, input, pressed);
      if (mode === "ruins" || mode === "jewels") puzzle(state, input, pressed, mode === "jewels");
      if (mode === "stack") stacking(state, pressed);
      state.input = input;
      state.score = Math.min(cap, state.score);
      if (state.status === "playing") {
        if (state.score >= cap || (mode === "ruins" && !state.pieces.some(piece => piece.kind < 4))) state.status = "won";
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
    rect(x-8,y+7,16,3,"#080b18aa");
    if (avatar) ctx.drawImage(avatar, Math.round(x-8), Math.round(y-17), 16, 32);
    else { rect(x-6,y-6,12,14,light); rect(x-3,y-4,6,4,"#fff0cf"); }
  };
  rect(0,0,240,160,sky);
  if (mode === "orbit") {
    for (let i = 0; i < 44; i++) {
      const y = 20 + (i * 31 + Math.floor(s.ticks / (i % 4 + 4))) % 137;
      rect((i * 53 + 17) % 240, y, i % 4 === 0 ? 2 : 1, 1, i % 3 === 0 ? light : floor);
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
  if (mode === "jewels" || mode === "ruins") {
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
    brick(Math.round(s.x),147-s.stack.length*10,top.width,light);
    hero(220,138);
  } else {
    if (mode === "bounce") {
      const hazard=120+Math.round(Math.sin(s.ticks/36)*65);
      rect(hazard-16,149,32,5,"#e35f77");
      for (let i=-15;i<16;i+=6) rect(hazard+i,145,4,4,"#ffa18c");
      s.pieces.forEach(p=>gem(p.x,p.y,colors[p.kind]));
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
    if(s.ticks>=s.cooldown || Math.floor(s.ticks/5)%2===0) hero(s.x,s.y);
  }
  rect(0,0,240,17,"#101522");
  ctx.fillStyle = s.flash > s.ticks ? "#fff1ba" : light;
  ctx.font = "bold 9px monospace"; ctx.textAlign = "left";
  ctx.fillText(`FASE ${s.wave+1}  ·  ${s.score} PTS`,8,12);
  ctx.textAlign = "right"; ctx.fillText(`${s.lives} VIDAS`,232,12);
}

export const pixel16 = {
  NAVALHA_RUSH: makeGame("blaster", "NAVALHA_RUSH", 400),
  ESCALADA_KONG: makeGame("bounce", "ESCALADA_KONG", 350),
  ORBITA_PIXEL: makeGame("orbit", "ORBITA_PIXEL", 400),
  BARBA_FIGHTER: makeGame("ruins", "BARBA_FIGHTER", 400),
  BARBER_VALLEY: makeGame("jewels", "BARBER_VALLEY", 450),
  TORRE_FADE: makeGame("stack", "TORRE_FADE", 250),
};
