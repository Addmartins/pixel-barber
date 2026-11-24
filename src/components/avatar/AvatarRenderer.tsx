import type { CSSProperties } from "react";
import { avatars, type AvatarId } from "@/lib/avatars";
import { avatarCollection, isCollectionCode } from "@/lib/avatar-collection";
import { isFashionCode } from "@/lib/avatar-fashion";
import { cosmeticSlot, splitCosmetic, type CosmeticCode, type CosmeticSlot, type EquippedCosmetic } from "@/lib/store";
import { BarberChairArms, BarberChairBack, BladeAura, SeatedDenim } from "./AvatarEffects";
import { BareLegs, BaseMoustache, BodyArt, DenimArt, HairArt } from "./AvatarBaseArt";
import { CosmeticArt } from "./CosmeticArt";

interface AvatarProps {
  skinId: AvatarId;
  cosmetics?: readonly EquippedCosmetic[];
  size?: number;
  className?: string;
  portrait?: boolean;
}

const placement: Record<CosmeticSlot, [number, number, number, number]> = {
  legs: [0, 0, 32, 64], feet: [0, 0, 32, 64],
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

function Accessory({ code, shirtNumber }: { code: CosmeticCode; shirtNumber?: number }) {
  if (isFashionCode(code)) return <g data-cosmetic={code}><CosmeticArt code={code} shirtNumber={shirtNumber} mounted /></g>;
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

export function AvatarRenderer({ skinId, cosmetics = [], size = 64, className, portrait = false }: AvatarProps) {
  const skin = avatars.find(({ id }) => id === skinId) ?? avatars[0];
  const style = { "--avatar-size": `${size}px`, "--avatar-backdrop": skin.backdrop } as CSSProperties;
  const accessories = cosmetics.map(splitCosmetic);
  const outfit = (slot: CosmeticSlot) => accessories.filter(({ code }) => cosmeticSlot(code) === slot)
    .map(item => <Accessory key={item.code} {...item} />);

  const launchChair = cosmetics.includes("trono_inauguracao");
  const launchAura = cosmetics.includes("aura_letreiro");
  const seated = !portrait && (launchChair || cosmetics.includes("cadeira_barbear"));
  const aura = launchAura || cosmetics.includes("aura_laminas");
  const fashionTop = accessories.find(({ code }) => isFashionCode(code) && cosmeticSlot(code) === "body");
  const dress = fashionTop?.code.startsWith("vestido_");
  const shorts = dress ? [] : outfit("legs");
  const shoes = outfit("feet");
  const denim = seated ? <SeatedDenim /> : <DenimArt />;
  const lower = (
    <>
      {dress || shorts.length ? <>
        <BareLegs skinId={skin.id} seated={seated} />
        {!shoes.length && <svg y="58" width="32" height="6" viewBox="0 58 32 6" overflow="hidden">{denim}</svg>}
        <g transform={seated ? "translate(0 17) scale(1 .72)" : undefined}>{shorts}</g>
      </> : denim}
      <g transform={seated ? "translate(0 -1)" : undefined}>{shoes}</g>
    </>
  );
  const hair = outfit("hair");
  const beard = outfit("beard");
  const upper = (
    <g className="layer layer-avatar-upper" transform={seated ? "translate(0 7)" : undefined}>
      <BodyArt skinId={skin.id} showShirt={!fashionTop} />
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
      <svg className="pixel-avatar-art" viewBox={portrait ? "-2 -3 36 36" : "0 0 32 64"} shapeRendering="crispEdges" focusable="false"
        data-pose={seated ? "seated" : "standing"}>
        {aura && <BladeAura launch={launchAura} />}
        {seated && <BarberChairBack launch={launchChair} />}
        {!portrait && (!seated || dress) && lower}
        {seated ? <svg width="32" height={dress ? 55 : 49} viewBox={dress ? "0 0 32 55" : "0 0 32 49"} overflow="hidden">{upper}</svg> : upper}
        {seated && !dress && lower}
        {seated && <BarberChairArms launch={launchChair} />}
        <g transform={seated ? "translate(0 7)" : undefined}>{outfit("tool")}</g>
      </svg>
    </span>
  );
}
