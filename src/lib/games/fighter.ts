import { A, B, LEFT, RIGHT, type Game, type GameState } from "./types";

const opponents = [
  { name: "LENHADOR NÓRDICO", skin: "#de9469", beard: "#934c38", shirt: "#427669", health: 5 },
  { name: "HIPSTER DE FERRO", skin: "#ae745f", beard: "#2e253a", shirt: "#5b668e", health: 7 },
] as const;

type Phase = "idle" | "warning" | "strike" | "opening";

type FighterState = GameState & {
  opponent: number;
  health: number;
  hearts: number;
  streak: number;
  special: boolean;
  cycle: number;
  phase: Phase;
  expires: number;
  direction: number;
  tool: number;
  dodged: boolean;
  previousInput: number;
  random: number;
  flash: number;
  attack: number;
  turboFlash: number;
};

function create(seed: number): FighterState {
  return {
    score: 0, ticks: 0, status: "playing", opponent: 0, health: opponents[0].health,
    hearts: 4, streak: 0, special: false, cycle: 0, phase: "idle", expires: 62,
    direction: LEFT, tool: A, dodged: false, previousInput: 0, random: seed | 0, flash: 0, attack: 0, turboFlash: 0,
  };
}

function resetCombo(state: FighterState) {
  state.streak = 0;
  state.special = false;
}

function beginWarning(state: FighterState) {
  // Each round selects the next side from the session seed.
  state.random = (Math.imul(state.random, 1664525) + 1013904223) | 0;
  state.direction = state.random >>> 30 < 2 ? LEFT : RIGHT;
  state.tool = state.cycle % 2 === 0 ? A : B;
  state.cycle += 1;
  state.phase = "warning";
  state.expires = state.ticks + (state.opponent ? 44 : 54);
}

function hit(state: FighterState, usingSpecial: boolean) {
  state.attack = 16;
  if (usingSpecial) state.turboFlash = 30;
  state.health -= usingSpecial ? 2 : 1;
  state.score = Math.min(400, state.score + (usingSpecial ? 44 : 22));
  if (usingSpecial) resetCombo(state);
  else {
    state.streak++;
    state.special = state.streak >= 5;
  }

  state.phase = "idle";
  state.expires = state.ticks + 24;
  if (state.health > 0) return;

  if (state.opponent === 0) {
    state.opponent = 1;
    state.health = opponents[1].health;
    state.expires = state.ticks + 95;
    state.score += 25;
    return;
  }

  state.score = Math.min(400, state.score + 45 + (state.hearts === 4 ? 40 : 0));
  state.status = "won";
}

function step(state: FighterState, input: number) {
  if (state.status !== "playing") return;
  state.ticks++;
  const pressed = input & ~state.previousInput;
  state.previousInput = input;
  state.attack = Math.max(0, state.attack - 1);
  state.flash = Math.max(0, state.flash - 1);
  state.turboFlash = Math.max(0, state.turboFlash - 1);
  if (state.ticks >= 3600) {
    state.status = "lost";
    return;
  }

  if (state.phase === "opening") {
    if (pressed & (A | B)) {
      if (state.special && (pressed & B)) {
        hit(state, true);
        return;
      }
      if ((pressed & (A | B)) === state.tool) {
        hit(state, false);
        return;
      }
      resetCombo(state);
    }
  }

  if (state.ticks < state.expires) return;

  switch (state.phase) {
    case "idle":
      beginWarning(state);
      break;
    case "warning":
      // The shown direction is the safe side of the chair.
      state.dodged = (input & (LEFT | RIGHT)) === state.direction;
      state.phase = "strike";
      state.expires = state.ticks + 10;
      if (!state.dodged) {
        state.hearts--;
        state.flash = 16;
        resetCombo(state);
        if (!state.hearts) state.status = "lost";
      }
      break;
    case "strike":
      state.phase = state.dodged ? "opening" : "idle";
      state.expires = state.ticks + (state.dodged ? 46 : 22);
      break;
    case "opening":
      resetCombo(state);
      state.phase = "idle";
      state.expires = state.ticks + 22;
      break;
  }
}

function draw(ctx: CanvasRenderingContext2D, state: FighterState) {
  function block(x: number, y: number, width: number, height: number, color: string) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, width, height);
  }

  function text(value: string, x: number, y: number, color = "#f7e6d4") {
    ctx.fillStyle = color;
    ctx.font = "bold 8px monospace";
    ctx.textAlign = "left";
    ctx.fillText(value, x, y);
  }

  const opponent = opponents[state.opponent];
  ctx.imageSmoothingEnabled = false;
  block(0, 0, 240, 160, "#20343d");
  for (let y = 42; y < 112; y += 14) {
    for (let x = -7; x < 240; x += 28) {
      block(x + (y % 4 ? 14 : 0), y, 26, 12, "#264550");
    }
  }
  block(0, 115, 240, 45, "#372735");
  for (let x = 0; x < 240; x += 20) {
    block(x, 115, 1, 45, "#50384b");
  }
  block(0, 127, 240, 2, "#50384b");
  block(0, 145, 240, 2, "#50384b");

  // Chair frame, stepped head silhouette and beard.
  block(150, 68, 48, 45, "#6e344b");
  block(155, 70, 39, 41, "#994961");
  block(157, 115, 34, 5, "#88809a");
  block(171, 110, 8, 15, "#88809a");
  const ox = state.phase === "strike" ? 149 : 160;
  const oy = state.attack ? 53 : 50;
  const blinking = state.phase === "warning" && Math.floor(state.ticks / 7) % 2 === 0;
  block(ox - 4, oy + 29, 36, 25, opponent.shirt);
  block(ox + 1, oy + 2, 26, 25, opponent.beard);
  block(ox + 4, oy + 7, 20, 17, opponent.skin);
  block(ox, oy + 19, 28, 8, opponent.beard);
  block(ox + 4, oy + 27, 20, blinking ? 6 : 9, opponent.beard);
  block(ox + 8, oy + 12, 4, blinking ? 1 : 3, "#231a29");
  block(ox + 17, oy + 12, 4, blinking ? 1 : 3, "#231a29");

  // Barber sprite, pushed onto the safe side of the floor by the D-pad.
  const movement = state.previousInput & (LEFT | RIGHT);
  const px = movement === LEFT ? 48 : movement === RIGHT ? 82 : 65;
  const tint = state.flash ? "#ff7684" : "#dd9e78";
  block(px - 6, 98, 22, 22, "#5dd2bd");
  block(px - 2, 120, 5, 7, "#181a2c");
  block(px + 6, 120, 5, 7, "#181a2c");
  block(px - 2, 85, 15, 13, tint);
  block(px - 3, 82, 15, 5, "#302337");
  block(px + 8, 89, 3, 3, "#302337");
  if (state.attack) {
    block(px + 13, 96, 17, 4, "#ece8ef");
    block(px + 26, 94, 6, 3, "#ece8ef");
    block(ox - 12, oy + 11, 9, 2, "#fde29c");
  }
  if (state.turboFlash) {
    const waveX = 112 + (30 - state.turboFlash) * 2;
    block(waveX, 85, 19, 3, "#80f3da");
    block(waveX - 8, 91, 29, 3, "#d0fae2");
    block(waveX + 7, 97, 16, 3, "#fde29c");
    text("CORTE TURBO!", 85, 59, "#80f3da");
  }

  block(0, 0, 240, 34, "#171222");
  text(opponent.name, 8, 12);
  text(`FÔLEGO ${state.hearts}/4`, 167, 12);
  block(8, 19, 90, 5, "#462e48");
  block(8, 19, Math.ceil(90 * Math.max(0, state.health) / opponent.health), 5, "#ff828d");
  text(`RITMO ${Math.min(state.streak, 5)}/5`, 167, 24, "#93f0d4");

  block(0, 134, 240, 26, "#171222");
  if (state.status === "won") text("TRABALHO IMPECÁVEL!", 8, 150, "#98f4d0");
  else if (state.status === "lost") text("FIM DO TURNO", 8, 150, "#ff9f9c");
  else if (state.phase === "warning") {
    text(state.direction === LEFT ? "ESQUIVE PARA A ESQUERDA" : "ESQUIVE PARA A DIREITA", 8, 150, "#ffd47f");
  } else if (state.phase === "opening") {
    text(state.special ? "B · CORTE TURBO!" : state.tool === A ? "A · TESOURA, AGORA!" : "B · NAVALHA, AGORA!", 8, 150, "#98f4d0");
  } else {
    text(state.phase === "strike" ? state.dodged ? "BOA ESQUIVA!" : "CUIDADO!" : "ATENÇÃO AO CLIENTE", 8, 150);
  }
}

export const fighter: Game<FighterState> = { create, step, draw };
