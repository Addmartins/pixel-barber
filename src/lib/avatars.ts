export const avatars = [
  { id: "fade", name: "Fade", backdrop: "#312441" },
  { id: "bigode", name: "Bigode", backdrop: "#382a43" },
  { id: "pompadour", name: "Pompadour", backdrop: "#392439" },
  { id: "trancas", name: "Tranças", backdrop: "#2b294c" },
] as const;

export type AvatarId = (typeof avatars)[number]["id"];
export const consentVersion = "2026-11-21-phone-preview";
