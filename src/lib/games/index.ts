import { pixel16 } from "./pixel16";
import { fighter } from "./fighter";
import { maze } from "./maze";
import { kong } from "./kong";
import { snake } from "./snake";
import { valley } from "./valley";
import { tower } from "./tower";
import { gameVersion, isOrbitVersion, maxTicks, type EngineVersion, type Difficulty, type Game, type GameCode, type GameState, type InputChange } from "./types";

function instantiate<S extends GameState>(game: Game<S>, seed: number, difficulty: Difficulty, version: EngineVersion) {
  const state = game.create(seed, difficulty, version);
  return {
    state,
    step(input: number) {
      if (state.status !== "playing") return;
      game.step(state, input);
      if (state.ticks >= maxTicks && state.status === "playing") state.status = "lost";
    },
    draw(ctx: CanvasRenderingContext2D, avatar?: CanvasImageSource) { game.draw(ctx, state, avatar); },
  };
}

export function createGame(code: GameCode, seed: number, difficulty: Difficulty = "EASY", version: EngineVersion = gameVersion) {
  if (code === "ORBITA_PIXEL" || (code === "NAVALHA_RUSH" && isOrbitVersion(version))) {
    return instantiate(pixel16.ORBITA_PIXEL, seed, difficulty, version);
  }
  if ((version === 4 || version === gameVersion) && code !== "BIGODE_SNAKE") return instantiate(pixel16[code], seed, difficulty, version);
  switch (code) {
    case "NAVALHA_RUSH": return instantiate(maze, seed, difficulty, version);
    case "BARBA_FIGHTER": return instantiate(fighter, seed, difficulty, version);
    case "TORRE_FADE": return instantiate(tower, seed, difficulty, version);
    case "ESCALADA_KONG": return instantiate(kong, seed, difficulty, version);
    case "BIGODE_SNAKE": return instantiate(snake, seed, difficulty, version);
    case "BARBER_VALLEY": return instantiate(valley, seed, difficulty, version);
  }
}

export function replay(code: GameCode, seed: number, ticks: number, changes: InputChange[], difficulty: Difficulty = "EASY", version: EngineVersion = gameVersion) {
  const engine = createGame(code, seed, difficulty, version);
  let mask = 0;
  let next = 0;
  for (let tick = 0; tick < ticks; tick++) {
    if (engine.state.status !== "playing") return null;
    const change = changes[next];
    if (change?.[0] === tick) {
      mask = change[1];
      next++;
    }
    engine.step(mask);
  }

  return engine.state.status === "playing" || engine.state.ticks !== ticks ? null : engine.state;
}
