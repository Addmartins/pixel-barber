import { fighter } from "./fighter";
import { maze } from "./maze";
import { kong } from "./kong";
import { snake } from "./snake";
import { valley } from "./valley";
import { tower } from "./tower";
import { maxTicks, type Difficulty, type Game, type GameCode, type GameState, type InputChange } from "./types";

function instantiate<S extends GameState>(game: Game<S>, seed: number, difficulty: Difficulty) {
  const state = game.create(seed, difficulty);
  return {
    state,
    step(input: number) {
      if (state.status !== "playing") return;
      game.step(state, input);
      if (state.ticks >= maxTicks && state.status === "playing") state.status = "lost";
    },
    draw(ctx: CanvasRenderingContext2D) { game.draw(ctx, state); },
  };
}

export function createGame(code: GameCode, seed: number, difficulty: Difficulty = "EASY") {
  switch (code) {
    case "NAVALHA_RUSH": return instantiate(maze, seed, difficulty);
    case "BARBA_FIGHTER": return instantiate(fighter, seed, difficulty);
    case "TORRE_FADE": return instantiate(tower, seed, difficulty);
    case "ESCALADA_KONG": return instantiate(kong, seed, difficulty);
    case "BIGODE_SNAKE": return instantiate(snake, seed, difficulty);
    case "BARBER_VALLEY": return instantiate(valley, seed, difficulty);
  }
}

export function replay(code: GameCode, seed: number, ticks: number, changes: InputChange[], difficulty: Difficulty = "EASY") {
  const engine = createGame(code, seed, difficulty);
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
