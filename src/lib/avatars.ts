export const avatars = [
  { id: "fade", name: "Degradê", backdrop: "#312441" },
  { id: "bigode", name: "Estilo Clássico", backdrop: "#382a43" },
  { id: "pompadour", name: "Topete", backdrop: "#392439" },
  { id: "trancas", name: "Tranças Pixel", backdrop: "#2b294c" },
] as const;

export type AvatarId = (typeof avatars)[number]["id"];
export const consentVersion = "2026-11-23-termos";
