import { deviceApi } from "../device/api";
import { getSupabase } from "../supabase/browser";
import { gameVersion, orbitVersion, type ArcadeStats, type Difficulty, type GameCode, type GameResult, type InputChange, type Run } from "./types";

type Finish = { action: "finish"; id: string; ticks: number; changes: InputChange[] };

async function send<T>(body: { action: "start"; game: GameCode; difficulty: Difficulty; engineVersion: number } | Finish): Promise<T> {
  const session = await getSupabase()?.auth.getSession();
  const token = session?.data.session?.access_token;
  if (!token) throw new Error("Entre na sua conta para registrar a partida.");
  const response = await fetch(deviceApi("/api/arcade"), {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "O registro de partidas está indisponível.");
  return result;
}

export function startRun(game: GameCode, difficulty: Difficulty) {
  return send<Run>({ action: "start", game, difficulty, engineVersion: game === "ORBITA_PIXEL" ? orbitVersion : gameVersion });
}

export function finishRun(id: string, ticks: number, changes: InputChange[]) {
  return send<GameResult>({ action: "finish", id, ticks, changes });
}

export async function getArcadeStats(): Promise<ArcadeStats> {
  const result = await getSupabase()?.rpc("get_arcade_stats");
  if (!result || result.error) throw new Error("Não foi possível atualizar os recordes pessoais.");
  return { records: result.data, credited_today: result.data[0]?.credited_today ?? 0 };
}
