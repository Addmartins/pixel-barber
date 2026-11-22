import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AvatarId } from "../avatars";
import type { Barber, Service, Slot } from "../booking";
import type { Difficulty, GameCode, GameRecord, GameResult } from "../games/types";

import type { CosmeticCode, CosmeticProduct, InventoryItem } from "../store";

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

type CatalogTable<Row> = { Row: Row; Insert: never; Update: never; Relationships: [] };
type AppointmentStatus = "AGENDADO" | "CONCLUIDO" | "CANCELADO" | "NO_SHOW";
type AppointmentRow = {
  id: string;
  client_id: string;
  barber_id: string;
  service_id: string;
  starts_at: string;
  ends_at: string;
  data: string;
  hora: string;
  status: AppointmentStatus;
  cancelled_at: string | null;
};
export type PointType = "LOGIN" | "JOGO" | "CORTE" | "COMPRA" | "FALTA_NO_SHOW" | "RESGATE_AVATAR";
export type PointEntry = {
  id: string; client_id: string; quantidade: number; tipo: PointType; descricao: string; event_key: string; created_at: string;
};
export type RankingEntry = { position: number; display_name: string; avatar_skin: AvatarId; points_balance: number; mastered_games?: GameCode[]; equipped_cosmetics?: CosmeticCode[]; shirt_number?: number | null };

export type Database = {
  public: {
    Tables: {
      clients: {
        Row: ClientRow;
        Insert: never;
        Update: Partial<Pick<ClientRow, "nome" | "avatar_skin">>;
        Relationships: [];
      };
      point_ledger: CatalogTable<PointEntry>;
      game_sessions: CatalogTable<{
        id: string; client_id: string; game_code: GameCode; difficulty: Difficulty; seed: number; engine_version: number; started_at: string;
      }>;
      store_products: CatalogTable<Omit<CosmeticProduct, "preco_pontos" | "cosmetic_code" | "cosmetic_slot" | "rarity"> & {
        categoria: string; preco_pontos: number | null; cosmetic_code: CosmeticCode | null;
        cosmetic_slot: CosmeticProduct["cosmetic_slot"] | null; rarity: CosmeticProduct["rarity"] | null;
      }>;
      client_inventory: CatalogTable<InventoryItem & { id: string; client_id: string; acquired_at: string }>;
      barbers: CatalogTable<Barber>;
      services: CatalogTable<Service>;
      appointments: {
        Row: AppointmentRow;
        Insert: never;
        Update: never;
        Relationships: [
          { foreignKeyName: "appointments_barber_id_fkey"; columns: ["barber_id"]; referencedRelation: "barbers"; referencedColumns: ["id"]; isOneToOne: false },
          { foreignKeyName: "appointments_service_id_fkey"; columns: ["service_id"]; referencedRelation: "services"; referencedColumns: ["id"]; isOneToOne: false }
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_available_slots: { Args: { p_barber_id: string; p_service_id: string; p_date: string }; Returns: Slot[] };
      create_appointment: { Args: { p_barber_id: string; p_service_id: string; p_starts_at: string }; Returns: string };
      cancel_appointment: { Args: { p_appointment_id: string }; Returns: boolean };
      start_arcade_run: { Args: { p_client_id: string; p_game_code: GameCode; p_engine_version: number; p_difficulty: Difficulty }; Returns: { id: string; seed: number }[] };
      finish_arcade_run: { Args: { p_client_id: string; p_session_id: string; p_score: number; p_ticks: number; p_engine_version: number; p_won: boolean }; Returns: GameResult[] };
      get_arcade_stats: { Args: Record<PropertyKey, never>; Returns: (GameRecord & { credited_today: number })[] };
      buy_avatar_item: { Args: { p_product_id: string }; Returns: { points_balance: number }[] };
      equip_avatar_item: { Args: { p_product_id: string; p_equipped: boolean }; Returns: boolean };
      set_avatar_shirt_number: { Args: { p_number: number }; Returns: number };
      get_leaderboard: { Args: { p_limit?: number; p_offset?: number }; Returns: RankingEntry[] };
    };
    Enums: { appointment_status: AppointmentStatus };
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
