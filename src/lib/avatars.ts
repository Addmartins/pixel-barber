export const avatars = [
  { id: "fade", name: "Fade", hair: "#211728", skin: "#d68c61", shirt: "#49d8c5", backdrop: "#312441" },
  { id: "bigode", name: "Bigode", hair: "#552b20", skin: "#f0b380", shirt: "#f2ae54", backdrop: "#382a43" },
  { id: "pompadour", name: "Pompadour", hair: "#45222f", skin: "#ad6549", shirt: "#f66589", backdrop: "#392439" },
  { id: "trancas", name: "Tranças", hair: "#241a2b", skin: "#8e513e", shirt: "#a992ff", backdrop: "#2b294c" },
] as const;

export type AvatarId = (typeof avatars)[number]["id"];
export const consentVersion = "2026-11-21-phone-preview";
