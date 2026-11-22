import type { CosmeticCode } from "@/lib/store";
import { CosmeticArt, cosmeticViewBox } from "@/components/avatar/CosmeticArt";

export function CosmeticSprite({ code }: { code: CosmeticCode }) {
  return (
    <svg className="cosmetic-sprite" viewBox={cosmeticViewBox(code)} shapeRendering="crispEdges"
      aria-hidden="true" focusable="false">
      <CosmeticArt code={code} />
    </svg>
  );
}
