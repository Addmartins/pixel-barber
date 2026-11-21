import { BookingConflict, type BookingApi } from "../booking";
import { getSupabase } from "./browser";

function requireSupabase() {
  const client = getSupabase();
  if (!client) throw new Error("Supabase indisponível.");
  return client;
}

export function createBookingApi(clientId: string): BookingApi {
  return {
    async catalog() {
      const supabase = requireSupabase();
      const [services, barbers] = await Promise.all([
        supabase.from("services").select("*").order("pontos_recompensa").order("nome"),
        supabase.from("barbers").select("*").order("nome"),
      ]);
      if (services.error || barbers.error) throw services.error ?? barbers.error;
      return { services: services.data, barbers: barbers.data };
    },
    async appointments() {
      const { data, error } = await requireSupabase().from("appointments")
        .select("id,starts_at,services(nome),barbers(nome)")
        .eq("client_id", clientId).eq("status", "AGENDADO").gte("starts_at", new Date().toISOString())
        .order("starts_at").order("id");
      if (error) throw error;
      return data.map((row) => ({
        id: row.id,
        starts_at: row.starts_at,
        serviceName: row.services?.nome ?? "Serviço",
        barberName: row.barbers?.nome ?? "Barbeiro",
      }));
    },
    async slots(barberId, serviceId, date) {
      const { data, error } = await requireSupabase().rpc("get_available_slots", {
        p_barber_id: barberId, p_service_id: serviceId, p_date: date,
      });
      if (error) throw error;
      return data;
    },
    async create(barberId, serviceId, startsAt) {
      const { error } = await requireSupabase().rpc("create_appointment", {
        p_barber_id: barberId, p_service_id: serviceId, p_starts_at: startsAt,
      });
      if (error?.code === "23P01" || error?.code === "22023") throw new BookingConflict();
      if (error) throw error;
    },
    async cancel(id) {
      const { data, error } = await requireSupabase().rpc("cancel_appointment", { p_appointment_id: id });
      if (error) throw error;
      return data;
    },
  };
}

export async function getRankingPage(limit: number, offset: number) {
  const { data, error } = await requireSupabase().rpc("get_leaderboard", { p_limit: limit, p_offset: offset });
  if (error) throw error;
  return data;
}
