import { BookingConflict, cancellationWindowMs, type Appointment, type Barber, type BookingApi, type Service } from "./booking";
import type { RankingEntry } from "./supabase/browser";

const services: Service[] = [
  { id: "corte", nome: "Corte", duracao_minutos: 30, preco_reais: 45, pontos_recompensa: 9 },
  { id: "barba", nome: "Barba", duracao_minutos: 25, preco_reais: 35, pontos_recompensa: 7 },
  { id: "combo", nome: "Combo", duracao_minutos: 55, preco_reais: 75, pontos_recompensa: 15 },
];
const barbers: Barber[] = [
  { id: "navalha", nome: "Mestre Navalha", especialidade: "Barba e acabamento", foto_pixel: null, endereco: null },
  { id: "du-corte", nome: "Du Corte", especialidade: "Degradês e fades", foto_pixel: null, endereco: null },
];

export const demoRanking: RankingEntry[] = [
  { position: 1, display_name: "Lia", avatar_skin: "pompadour", points_balance: 340 },
  { position: 2, display_name: "Nico", avatar_skin: "fade", points_balance: 260 },
  { position: 3, display_name: "Duda", avatar_skin: "trancas", points_balance: 195 },
  { position: 4, display_name: "Beto", avatar_skin: "bigode", points_balance: 120 },
];

export function createDemoBookingApi(): BookingApi {
  let appointments: (Appointment & { endsAt: number })[] = [];

  function available(startsAt: number, endsAt: number) {
    return startsAt > Date.now() && !appointments.some((row) =>
      Date.parse(row.starts_at) < endsAt && row.endsAt > startsAt);
  }

  return {
    async catalog() { return { services, barbers }; },
    async appointments() {
      return appointments.filter((row) => Date.parse(row.starts_at) > Date.now())
        .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
    },
    async slots(_barberId, serviceId, date) {
      const duration = services.find((service) => service.id === serviceId)?.duracao_minutos ?? 30;
      const opening = Date.parse(`${date}T09:00:00-03:00`);
      const closing = opening + 10 * 60 * 60 * 1000;
      return Array.from({ length: 20 }, (_, index) => {
        const start = opening + index * 30 * 60 * 1000;
        const end = start + duration * 60 * 1000;
        return { starts_at: new Date(start).toISOString(), available: end <= closing && available(start, end) };
      });
    },
    async create(barberId, serviceId, startsAt) {
      const barber = barbers.find(({ id }) => id === barberId);
      const service = services.find(({ id }) => id === serviceId);
      if (!barber || !service) throw new BookingConflict();
      const starts = Date.parse(startsAt);
      const endsAt = starts + service.duracao_minutos * 60 * 1000;
      if (!available(starts, endsAt)) throw new BookingConflict();
      appointments.push({ id: crypto.randomUUID(), starts_at: startsAt, endsAt, barberName: barber.nome, serviceName: service.nome });
    },
    async cancel(id) {
      const row = appointments.find((appointment) => appointment.id === id);
      if (!row || Date.parse(row.starts_at) - Date.now() < cancellationWindowMs) return false;
      appointments = appointments.filter((appointment) => appointment.id !== id);
      return true;
    },
  };
}
