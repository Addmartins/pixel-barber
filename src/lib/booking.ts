export type Service = {
  id: string;
  nome: string;
  duracao_minutos: number;
  preco_reais: number;
  pontos_recompensa: number;
};

export type Barber = { id: string; nome: string; especialidade: string; foto_pixel: string | null; endereco: string | null };
export type Slot = { starts_at: string; available: boolean };
export type Appointment = { id: string; starts_at: string; serviceName: string; barberName: string };
export type BookingApi = {
  catalog: () => Promise<{ services: Service[]; barbers: Barber[] }>;
  appointments: () => Promise<Appointment[]>;
  slots: (barberId: string, serviceId: string, date: string) => Promise<Slot[]>;
  create: (barberId: string, serviceId: string, startsAt: string) => Promise<void>;
  cancel: (id: string) => Promise<boolean>;
};

export const cancellationWindowMs = 15 * 60 * 1000;
const timeZone = "America/Sao_Paulo";
const dateKey = new Intl.DateTimeFormat("sv-SE", { dateStyle: "short", timeZone });
const dateLabel = new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeZone });
const timeLabel = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone });
export const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function brasiliaDate(timestamp: number) {
  return dateKey.format(timestamp);
}

export function appointmentDate(startsAt: string) {
  return dateLabel.format(new Date(startsAt));
}

export function appointmentTime(startsAt: string) {
  return timeLabel.format(new Date(startsAt));
}

export function countdown(remainingMs: number) {
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const days = Math.floor(seconds / 86400);
  const clock = [Math.floor(seconds / 3600) % 24, Math.floor(seconds / 60) % 60, seconds % 60]
    .map((value) => String(value).padStart(2, "0")).join(":");
  return days ? `${days}d ${clock}` : clock;
}

export class BookingConflict extends Error {}
