export const gameCodes = ["NAVALHA_RUSH", "BARBA_FIGHTER", "TORRE_FADE"] as const;
export type GameCode = (typeof gameCodes)[number];
export const LEFT = 1;
export const RIGHT = 2;
export const UP = 4;
export const DOWN = 8;
export const A = 16;
export const B = 32;

export const gameVersion = 1;
export const ticksPerSecond = 60;
export const maxTicks = 3600;
export const canvasWidth = 240;
export const canvasHeight = 160;

export type GameState = { score: number; ticks: number; status: "playing" | "won" | "lost" };
export type State = GameState;
export type Game<S extends GameState = GameState> = {
  create(seed: number): S;
  step(state: S, input: number): void;
  draw(ctx: CanvasRenderingContext2D, state: S): void;
};

export type InputChange = [tick: number, mask: number];
export type Run = { id: string; seed: number; game: GameCode };
export type GameRecord = { game_code: GameCode; high_score: number };
export type ArcadeStats = { records: GameRecord[]; credited_today: number };
export type GameResult = {
  score: number;
  points_awarded: number;
  points_balance: number;
  high_score: number;
  credited_today: number;
};

export function isGameCode(value: unknown): value is GameCode {
  return gameCodes.some((code) => code === value);
}
