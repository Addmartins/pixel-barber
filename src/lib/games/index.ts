import { fighter } from "./fighter";
import { maze } from "./maze";
import { tower } from "./tower";
import { maxTicks, type Game, type GameCode, type GameState, type InputChange } from "./types";

function instantiate<S extends GameState>(game: Game<S>, seed: number) {
  const state = game.create(seed);
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

export function createGame(code: GameCode, seed: number) {
  switch (code) {
    case "NAVALHA_RUSH": return instantiate(maze, seed);
    case "BARBA_FIGHTER": return instantiate(fighter, seed);
    case "TORRE_FADE": return instantiate(tower, seed);
  }
}

export function replay(code: GameCode, seed: number, ticks: number, changes: InputChange[]) {
  const engine = createGame(code, seed);
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
