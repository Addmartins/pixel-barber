import type { CSSProperties } from "react";
import { avatars, type AvatarId } from "@/lib/avatars";
import { avatarCollection, isCollectionCode } from "@/lib/avatar-collection";
import { cosmeticSlot, type CosmeticCode, type CosmeticSlot } from "@/lib/store";
import { BodyArt, DenimArt, HairArt } from "./AvatarBaseArt";
import { CosmeticArt } from "./CosmeticArt";

interface AvatarProps {
  skinId: AvatarId;
  cosmetics?: readonly CosmeticCode[];
  size?: number;
  className?: string;
}

const placement: Record<CosmeticSlot, [number, number, number, number]> = {
  scene: [0, 30, 32, 34], body: [6, 23, 20, 25], hair: [5, 0, 23, 19],
  beard: [8, 16, 17, 13], neck: [9, 24, 14, 13], face: [8, 8, 19, 16],
  head: [4, 0, 24, 17], tool: [19, 24, 13, 18], effect: [0, 11, 32, 32],
};

function Accessory({ code }: { code: CosmeticCode }) {
  if (!isCollectionCode(code)) return <CosmeticArt code={code} />;
  const item = avatarCollection[code];
  const [x, y, width, height] = placement[item.slot];
  return (
    <svg x={x} y={y} width={width} height={height} viewBox="0 0 24 24" preserveAspectRatio="none"
      data-rarity={item.rarity}>
      <CosmeticArt code={code} />
    </svg>
  );
}

export function AvatarRenderer({ skinId, cosmetics = [], size = 64, className }: AvatarProps) {
  const skin = avatars.find(({ id }) => id === skinId) ?? avatars[0];
  const style = { "--avatar-size": `${size}px`, "--avatar-backdrop": skin.backdrop } as CSSProperties;
  const outfit = (slot: CosmeticSlot) => cosmetics.filter(code => cosmeticSlot(code) === slot)
    .map(code => <Accessory key={code} code={code} />);

  return (
    <span className={`pixel-avatar${className ? ` ${className}` : ""}`} style={style} aria-hidden="true">
      <svg className="pixel-avatar-art" viewBox="0 0 32 64" shapeRendering="crispEdges" focusable="false">
        {outfit("scene")}
        <g className="layer layer-body"><BodyArt skinId={skin.id} /></g>
        <g className="layer layer-pants"><DenimArt /></g>
        {outfit("body")}
        <g className="layer layer-hair"><HairArt skinId={skin.id} /></g>
        {outfit("hair")}
        {outfit("beard")}
        {outfit("neck")}
        {outfit("face")}
        {outfit("head")}
        {outfit("tool")}
        {outfit("effect")}
      </svg>
    </span>
  );
}
