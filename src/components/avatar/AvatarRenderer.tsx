import type { CSSProperties } from "react";
import { avatars, type AvatarId } from "@/lib/avatars";
import { avatarCollection, isCollectionCode } from "@/lib/avatar-collection";
import { cosmeticSlot, type CosmeticCode, type CosmeticSlot } from "@/lib/store";
import { BarberChairArms, BarberChairBack, BladeAura, SeatedDenim } from "./AvatarEffects";
import { BaseMoustache, BodyArt, DenimArt, HairArt } from "./AvatarBaseArt";
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

const fittedAccessories: Partial<Record<CosmeticCode, [number, number, number, number]>> = {
  maquina_ouro: [21, 27, 11, 16],
  navalha_flamejante: [21, 25, 11, 17],
  coroa_barber: [6, 0, 21, 12],
  avental_lendario: [7, 23, 18, 22],
  cabelo_neon: [5, 1, 23, 17],
  tesoura_diamante: [21, 26, 11, 16],
  chapeu_supremo: [5, 0, 24, 14],
  tesoura_prisma: [21, 25, 11, 17],
  chapeu_fundador: [5, 0, 24, 14],
  avental_estreia: [7, 23, 18, 22],
};

const beardAnchors: Partial<Record<CosmeticCode, {
  frame: [number, number, number, number]; viewBox: string;
}>> = {
  bigode_fino: { frame: [11.5, 16, 13.5, 5], viewBox: "1 8 22 9" },
  barba_curta: { frame: [9, 16, 17, 9], viewBox: "2 7 20 15" },
  barba_lenhador: { frame: [9, 15.5, 17, 13], viewBox: "2 3 20 20" },
  barba_viking: { frame: [8.75, 15.75, 18, 13], viewBox: "1 2 22 21" },
};

function Accessory({ code }: { code: CosmeticCode }) {
  if (!isCollectionCode(code)) return <CosmeticArt code={code} />;
  const item = avatarCollection[code];
  const beard = beardAnchors[code];
  const [x, y, width, height] = beard?.frame ?? fittedAccessories[code] ?? placement[item.slot];
  return (
    <svg x={x} y={y} width={width} height={height} viewBox={beard?.viewBox ?? "0 0 24 24"} preserveAspectRatio="none"
      data-cosmetic={code} data-rarity={item.rarity}>
      <CosmeticArt code={code} mounted />
    </svg>
  );
}

export function AvatarRenderer({ skinId, cosmetics = [], size = 64, className }: AvatarProps) {
  const skin = avatars.find(({ id }) => id === skinId) ?? avatars[0];
  const style = { "--avatar-size": `${size}px`, "--avatar-backdrop": skin.backdrop } as CSSProperties;
  const outfit = (slot: CosmeticSlot) => cosmetics.filter(code => cosmeticSlot(code) === slot)
    .map(code => <Accessory key={code} code={code} />);

  const launchChair = cosmetics.includes("trono_inauguracao");
  const launchAura = cosmetics.includes("aura_letreiro");
  const seated = launchChair || cosmetics.includes("cadeira_barbear");
  const aura = launchAura || cosmetics.includes("aura_laminas");
  const hair = outfit("hair");
  const beard = outfit("beard");
  const upper = (
    <g className="layer layer-avatar-upper" transform={seated ? "translate(0 7)" : undefined}>
      <BodyArt skinId={skin.id} />
      {outfit("body")}
      {hair.length ? hair : <HairArt skinId={skin.id} />}
      {beard.length ? beard : skin.id === "bigode" && <BaseMoustache />}
      {outfit("neck")}
      {outfit("face")}
      {outfit("head")}
    </g>
  );

  return (
    <span className={`pixel-avatar${className ? ` ${className}` : ""}`} style={style} aria-hidden="true">
      <svg className="pixel-avatar-art" viewBox="0 0 32 64" shapeRendering="crispEdges" focusable="false"
        data-pose={seated ? "seated" : "standing"}>
        {aura && <BladeAura launch={launchAura} />}
        {seated ? <BarberChairBack launch={launchChair} /> : <DenimArt />}
        {seated ? <svg width="32" height="49" viewBox="0 0 32 49" overflow="hidden">{upper}</svg> : upper}
        {seated && <SeatedDenim />}
        {seated && <BarberChairArms launch={launchChair} />}
        <g transform={seated ? "translate(0 7)" : undefined}>{outfit("tool")}</g>
      </svg>
    </span>
  );
}
