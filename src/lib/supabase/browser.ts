import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AvatarId } from "../avatars";

type ClientRow = {
  id: string;
  nome: string;
  avatar_skin: AvatarId;
  level: number;
  points_balance: number;
  streak_days: number;
  consent_terms: boolean;
  consent_terms_at: string;
  consent_version: string;
};

type Database = {
  public: {
    Tables: {
      clients: {
        Row: ClientRow;
        Insert: never;
        Update: Partial<Pick<ClientRow, "nome" | "avatar_skin">>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

let client: SupabaseClient<Database> | undefined;

export function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return client ??= createClient<Database>(url, key);
}
