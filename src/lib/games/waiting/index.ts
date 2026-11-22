import { createWaitingRun, moving } from "./common";
import { golf } from "./golf";
import { penalties } from "./penalties";
import { pool } from "./pool";

export const waitingGames = [
  {
    id: "penalties", title: "Pênaltis", description: "Cinco cobranças contra o goleiro.",
    instructions: "Deslize em direção ao gol e solte para chutar. Um gesto mais longo dá mais força.",
    direction: 1,
    create(seed: number) {
      const run = createWaitingRun(penalties, seed);
      return { ...run, aim: () => run.state.shot ? null : { x: 120, y: 132 } };
    },
  },
  {
    id: "pool", title: "Sinuca", description: "Encaçape seis bolas com poucas tacadas.",
    instructions: "Arraste para trás e solte para tacar. Uma puxada mais longa dá mais força. A branca na caçapa soma uma tacada.",
    direction: -1,
    create(seed: number) {
      const run = createWaitingRun(pool, seed);
      return { ...run, aim: () => run.state.rolling ? null : run.state.balls[0] };
    },
  },
  {
    id: "golf", title: "Minigolfe", description: "Complete três buracos com obstáculos.",
    instructions: "Arraste para trás e solte para tacar. Uma puxada mais longa dá mais força. Espere a bola parar.",
    direction: -1,
    create(seed: number) {
      const run = createWaitingRun(golf, seed);
      return { ...run, aim: () => run.state.pause || moving(run.state.ball) ? null : run.state.ball };
    },
  },
] as const;

export type WaitingGame = (typeof waitingGames)[number];
