import type { AvatarId } from "./avatars";

export const muralBucket = "club-mural";
export const muralPhotoLimit = 4;
export const muralPhotoBytes = 6 * 1024 * 1024;
export const muralPhotoFormats: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
export const muralPhotoAccept = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";

export function muralPhotoType(file: File) {
  if (file.type === "image/jpg") return "image/jpeg";
  if (file.type && file.type !== "application/octet-stream") {
    return Object.hasOwn(muralPhotoFormats, file.type) ? file.type : undefined;
  }
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png" || extension === "webp") return `image/${extension}`;
}

export type MuralTag = { id: string; nome: string; avatar_skin: AvatarId };
export type ClubNotice = {
  id: string; title: string; body: string; created_at: string; photo_paths: string[];
  tagged_name: string | null; tagged_avatar: AvatarId | null;
};
export type ClubSuggestion = { id: string; client_id: string; body: string; created_at: string; reviewed_at: string | null };
export type Attendance = "AGENDADO" | "CONCLUIDO" | "CANCELADO" | "NO_SHOW";
export type ClubAppointment = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: Attendance;
  client_name: string;
  barber_name: string;
  service_name: string;
};
export type ClubMetrics = { scheduled: number; completed: number; cancelled: number; missed: number; pending_suggestions: number };

export const attendanceLabel: Record<Attendance, string> = {
  AGENDADO: "Agendado",
  CONCLUIDO: "Concluído",
  CANCELADO: "Cancelado",
  NO_SHOW: "Falta",
};

export const clubDateTime = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short", timeStyle: "short", timeZone: "America/Recife",
});
