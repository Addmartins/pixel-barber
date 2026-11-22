const storedGameCodes = ["NAVALHA_RUSH", "BARBA_FIGHTER", "TORRE_FADE", "ESCALADA_KONG", "BIGODE_SNAKE", "BARBER_VALLEY"] as const;
export const gameCodes = [...storedGameCodes, "ORBITA_PIXEL"] as const;
export type GameCode = (typeof gameCodes)[number];
export const LEFT = 1;
export const RIGHT = 2;
export const UP = 4;
export const DOWN = 8;
export const A = 16;
export const B = 32;

export const difficulties = ["EASY", "MEDIUM", "HARD"] as const;
export type Difficulty = (typeof difficulties)[number];

export const multipliers: Record<Difficulty, number> = { EASY: 1, MEDIUM: 1.5, HARD: 2.5 };

export function isDifficulty(value: unknown): value is Difficulty {
  return difficulties.some((difficulty) => difficulty === value);
}

export function roundSeconds(game: GameCode, difficulty: Difficulty) {
  if (game === "ESCALADA_KONG" && difficulty === "HARD") return 45;
  if (game !== "TORRE_FADE") return 60;
  return difficulty === "HARD" ? 30 : difficulty === "MEDIUM" ? 45 : 60;
}

export const gameVersion = 10;
export const orbitVersion = 11;
export const isOrbitVersion = (version: number) => version === 5 || version === 7 || version === 9 || version === orbitVersion;
export type EngineVersion = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | typeof gameVersion | typeof orbitVersion;
export function isEngineVersion(value: unknown): value is EngineVersion {
  return typeof value === "number" && Number.isInteger(value) && value >= 2 && value <= orbitVersion;
}
// Persisted arcade scores are also wallet credits in the current database.
export function gameCredit(rawScore: number, difficulty: Difficulty, loginMultiplier = 1) {
  if (rawScore <= 0) return 0;
  const base = Math.min(15, Math.max(1, Math.ceil(rawScore * multipliers[difficulty] / 50)));
  return Math.min(20, Math.round(base * loginMultiplier));
}
export const ticksPerSecond = 60;
export const maxTicks = 3600;
export const canvasWidth = 240;
export const canvasHeight = 160;

export type GameState = { lives?: number; score: number; ticks: number; status: "playing" | "won" | "lost"; jumps?: number };
export type State = GameState;
export type Game<S extends GameState = GameState> = {
  create(seed: number, difficulty: Difficulty, engineVersion?: EngineVersion): S;
  step(state: S, input: number): void;
  draw(ctx: CanvasRenderingContext2D, state: S, avatar?: CanvasImageSource): void;
};

export type InputChange = [tick: number, mask: number];
export type Run = { id: string; seed: number; game: GameCode; difficulty: Difficulty; engineVersion?: EngineVersion };
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
