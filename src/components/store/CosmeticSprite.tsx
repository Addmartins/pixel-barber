import type { CosmeticCode } from "@/lib/store";
import { CosmeticArt, cosmeticViewBox } from "@/components/avatar/CosmeticArt";

export function CosmeticSprite({ code, shirtNumber }: { code: CosmeticCode; shirtNumber?: number }) {
  return (
    <svg className="cosmetic-sprite" viewBox={cosmeticViewBox(code)} shapeRendering="crispEdges"
      aria-hidden="true" focusable="false">
      <CosmeticArt code={code} shirtNumber={shirtNumber} />
    </svg>
  );
}
