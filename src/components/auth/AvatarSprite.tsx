import { avatars, type AvatarId } from "@/lib/avatars";
import { isCosmeticCode, type CosmeticCode } from "@/lib/store";
import { cosmeticPixels } from "@/components/store/CosmeticSprite";

const faces = {
  fade: ["...hhhh...", "..hhhhhh..", "..hssssh..", "..sesses..", "..ssssss..", "...ssss...", "..ttsstt..", ".tttttttt."],
  bigode: ["...hhhh...", "..hhhhhh..", "..ssssss..", "..sesses..", "..shhhhs..", "...ssss...", "..ttsstt..", ".tttttttt."],
  pompadour: ["..hhhh....", ".hhhhhhh..", "..hssssh..", "..sesses..", "..ssssss..", "...ssss...", "..ttsstt..", ".tttttttt."],
  trancas: ["...hhhh...", "..hhhhhh..", ".hhsssshh.", ".hsessesh.", ".hssssssh.", ".h.ssss.h.", "..ttsstt..", ".tttttttt."],
};

export function AvatarSprite({ id, cosmetics = [] }: { id: AvatarId; cosmetics?: readonly CosmeticCode[] }) {
  const { hair, skin, shirt, backdrop } = avatars.find((avatar) => avatar.id === id) ?? avatars[0];
  const colors: Record<string, string> = { h: hair, s: skin, e: "#171222", t: shirt };
  return (
    <span className="sprite" aria-hidden="true" style={{ backgroundColor: backdrop }}>
      {faces[id].flatMap((row, y) => Array.from(row, (pixel, x) => (
        <span key={y * 10 + x} style={{ backgroundColor: colors[pixel], gridArea: `${y + 1} / ${x + 1}` }} />
      )))}
      {cosmetics.filter(isCosmeticCode).flatMap((code) => cosmeticPixels(code).map(({ x, y, color }) => (
        <span key={`${code}-${y * 10 + x}`} style={{
          backgroundColor: color,
          gridArea: `${y + 1} / ${x + 1}`,
        }} />
      )))}
    </span>
  );
}
