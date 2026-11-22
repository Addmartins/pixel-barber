import { createClient } from "@supabase/supabase-js";
import { replay } from "@/lib/games";
import { isEngineVersion, isDifficulty, isGameCode, maxTicks, multipliers, type InputChange } from "@/lib/games/types";
import type { Database } from "@/lib/supabase/browser";

export const runtime = "nodejs";

const bodyLimit = 64 * 1024;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function failure(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  if (!request.body || Number(request.headers.get("content-length")) > bodyLimit) return null;
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > bodyLimit) {
        await reader.cancel();
        return null;
      }
      text += decoder.decode(value, { stream: true });
    }
    const parsed: unknown = JSON.parse(text + decoder.decode());
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

function readReplay(ticks: unknown, changes: unknown): { ticks: number; changes: InputChange[] } | null {
  if (typeof ticks !== "number" || !Number.isInteger(ticks) || ticks < 1 || ticks > maxTicks ||
      !Array.isArray(changes) || changes.length > ticks) return null;
  const inputs: InputChange[] = [];
  let lastTick = -1;
  let lastMask = 0;
  for (const item of changes) {
    if (!Array.isArray(item) || item.length !== 2) return null;
    const [tick, mask] = item;
    if (!Number.isInteger(tick) || tick <= lastTick || tick >= ticks ||
        !Number.isInteger(mask) || mask < 0 || mask > 63 || mask === lastMask) return null;
    inputs.push([tick, mask]);
    lastTick = tick;
    lastMask = mask;
  }
  return { ticks, changes: inputs };
}

export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer ([^\s]+)$/i)?.[1];
  if (!token) return failure("Entre na sua conta para registrar a partida.", 401);
  const body = await readBody(request);
  if (!body || (body.action !== "start" && body.action !== "finish")) return failure("Partida inválida.", 400);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return failure("O registro de partidas está temporariamente indisponível.", 503);

  const supabase = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: auth, error: authError } = await supabase.auth.getUser(token);
  if (authError || !auth.user) return failure("Entre na sua conta para registrar a partida.", 401);
  const client = auth.user.id;

  if (body.action === "start") {
    const version = body.engineVersion ?? 2;
    if (!isEngineVersion(version)) return failure("Atualize o aplicativo para iniciar o jogo.", 400);
    if (!isGameCode(body.game) || !isDifficulty(body.difficulty)) {
      return failure("Escolha um cartucho e uma dificuldade válidos. Se a opção não aparecer, atualize a página.", 400);
    }
    const { data, error } = await supabase.rpc("start_arcade_run", {
      p_client_id: client, p_game_code: body.game, p_engine_version: version, p_difficulty: body.difficulty,
    }).single();
    if (error?.code === "P0001") return failure("Aguarde dois segundos antes de começar outra partida.", 429);
    if (error || !data) return failure("Não foi possível iniciar a partida.", 503);
    return Response.json({ id: data.id, seed: data.seed, game: body.game, difficulty: body.difficulty, engineVersion: version });
  }

  const sessionId = body.id;
  const input = readReplay(body.ticks, body.changes);
  if (typeof sessionId !== "string" || !uuid.test(sessionId) || !input) return failure("Comandos da partida inválidos.", 400);

  const { data: run, error: lookupError } = await supabase.from("game_sessions")
    .select("game_code,seed,engine_version,difficulty").eq("id", sessionId).eq("client_id", client).maybeSingle();
  if (lookupError) return failure("Não foi possível consultar a partida.", 503);
  if (!run || !isEngineVersion(run.engine_version) || !isDifficulty(run.difficulty)) return failure("Partida indisponível. Abra um novo cartucho.", 404);

  const result = replay(run.game_code, run.seed, input.ticks, input.changes, run.difficulty, run.engine_version);
  if (!result) return failure("A partida enviada está incompleta ou inconsistente.", 422);

  const { data, error } = await supabase.rpc("finish_arcade_run", {
    p_client_id: client, p_session_id: sessionId, p_score: Math.round(result.score * multipliers[run.difficulty]),
    p_ticks: input.ticks, p_engine_version: run.engine_version, p_won: result.status === "won",
  }).single();
  if (error?.code === "22023") return failure("A duração da partida não pôde ser validada ou a sessão expirou.", 422);
  if (error || !data) return failure("Não foi possível salvar. Tente enviar o resultado novamente.", 503);
  return Response.json(data);
}
