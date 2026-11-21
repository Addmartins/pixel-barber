import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/browser";

const productIdFormat = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;

export async function POST(request: Request) {
  const bearer = request.headers.get("authorization");
  if (!bearer || !/^Bearer \S+$/i.test(bearer)) {
    return Response.json({ error: "Entre na sua conta para resgatar um acessório." }, { status: 401 });
  }

  const body: unknown = Number(request.headers.get("content-length")) <= 1024
    ? await request.json().catch(() => null) : null;
  if (!body || typeof body !== "object" || !("product_id" in body) ||
      typeof body.product_id !== "string" || !productIdFormat.test(body.product_id) ||
      Object.keys(body).length !== 1) {
    return Response.json({ error: "Acessório inválido." }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return Response.json({ error: "A loja está indisponível." }, { status: 503 });

  const db = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: bearer } },
  });

  const { data, error } = await db.rpc("buy_avatar_item", { p_product_id: body.product_id }).single();
  if (data && !error) return Response.json(data);
  switch (error?.code) {
    case "PT404": return Response.json({ error: "Acessório indisponível no catálogo." }, { status: 404 });
    case "PT409": return Response.json({ error: "Este acessório está esgotado." }, { status: 409 });
    case "PT422": return Response.json({ error: "Seu saldo atual é insuficiente para o resgate." }, { status: 422 });
    case "PGRST301":
    case "PGRST303":
    case "42501": return Response.json({ error: "Entre na sua conta para resgatar um acessório." }, { status: 401 });
    default: return Response.json({ error: "Não foi possível concluir o resgate. Tente novamente." }, { status: 503 });
  }
}
