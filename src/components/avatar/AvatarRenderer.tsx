import type { CSSProperties } from "react";
import { avatars, type AvatarId } from "@/lib/avatars";
import type { CosmeticCode } from "@/lib/store";
import { BodyArt, DenimArt, HairArt } from "./AvatarBaseArt";
import { CosmeticArt, cosmeticLayers } from "./CosmeticArt";

interface AvatarProps {
  skinId: AvatarId;
  cosmetics?: readonly CosmeticCode[];
  size?: number;
  className?: string;
}

export function AvatarRenderer({ skinId, cosmetics = [], size = 64, className }: AvatarProps) {
  const skin = avatars.find(({ id }) => id === skinId) ?? avatars[0];
  const outfit = cosmeticLayers.filter((code) => cosmetics.includes(code));
  const style = { "--avatar-size": `${size}px`, "--avatar-backdrop": skin.backdrop } as CSSProperties;
  const layer = (code: CosmeticCode) => <g key={code} className={`layer layer-${code}`}><CosmeticArt code={code} /></g>;

  return (
    <span className={`pixel-avatar${className ? ` ${className}` : ""}`} style={style} aria-hidden="true">
      <svg className="pixel-avatar-art" viewBox="0 0 32 64" shapeRendering="crispEdges" focusable="false">
        <g className="layer layer-body"><BodyArt skinId={skin.id} /></g>
        <g className="layer layer-pants"><DenimArt /></g>
        {outfit.filter((code) => code === "avental" || code === "jaqueta").map(layer)}
        <g className="layer layer-hair"><HairArt skinId={skin.id} /></g>
        {outfit.filter((code) => code !== "avental" && code !== "jaqueta").map(layer)}
      </svg>
    </span>
  );
}
