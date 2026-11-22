import { createClient } from "@supabase/supabase-js";
import { advanceDailyLogin, dailyMultiplier, loginDay, parseDailyLogin } from "@/lib/daily-login";

export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer ([^\s]+)$/i)?.[1];
  if (!token) return new Response(null, { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return new Response(null, { status: 503 });

  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: auth, error } = await db.auth.getUser(token);
  if (error || !auth.user) return new Response(null, { status: 401 });

  const day = loginDay();
  const previous = parseDailyLogin(auth.user.app_metadata.pixel_daily_login);
  const login = advanceDailyLogin(previous, day);
  if (login !== previous) {
    // Concurrent calls for the same day compute the same state. Only the server can write app_metadata.
    const { error: updateError } = await db.auth.admin.updateUserById(auth.user.id, {
      app_metadata: { pixel_daily_login: login },
    });
    if (updateError) return new Response(null, { status: 503 });
  }
  return Response.json({ ...login, multiplier: dailyMultiplier(login, day) }, { headers: { "Cache-Control": "no-store" } });
}
