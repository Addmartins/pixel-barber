import type { CosmeticCode } from "@/lib/store";

type Drawing = {
  x: number;
  y: number;
  rows: readonly string[];
  palette: Readonly<Record<string, string>>;
};

const drawings: Record<CosmeticCode, Drawing> = {
  snapback: {
    x: 1, y: 0, rows: [".cccc...", "cchcc...", "bbbbbbb."],
    palette: { c: "#c73c74", h: "#ff91ad", b: "#582a50" },
  },
  boina: {
    x: 1, y: 0, rows: ["..ccc...", ".chcccb.", "cccccb.."],
    palette: { c: "#934946", h: "#dd9372", b: "#593137" },
  },
  aviador: {
    x: 1, y: 3, rows: ["ggg..ggg", "gslgglsg", ".gg..gg."],
    palette: { g: "#e2b964", s: "#68516e", l: "#21192c" },
  },
  avental: {
    x: 1, y: 5, rows: ["..l..l..", ".lcccll.", "lcschlcl"],
    palette: { l: "#8b5947", c: "#53362e", s: "#e7d7c5", h: "#bd8470" },
  },
  jaqueta: {
    x: 1, y: 5, rows: ["..h..h..", ".cchhcc.", "cdchhcdc"],
    palette: { c: "#456ba0", h: "#b2d1e4", d: "#254064" },
  },
  navalha: {
    x: 7, y: 4, rows: ["..h", ".gb", "gb.", "r.."],
    palette: { h: "#fff2a1", g: "#ffcc56", b: "#aa5527", r: "#6e3154" },
  },
  bandana: {
    x: 1, y: 0, rows: ["........", ".bbhbbb.", "bbhbbb.b"],
    palette: { b: "#45be99", h: "#aaf0be" },
  },
  tesoura: {
    x: 7, y: 4, rows: ["s.s", ".s.", ".r.", "r.r"],
    palette: { s: "#e1d8f4", r: "#a487e8" },
  },
};

export function cosmeticPixels(code: CosmeticCode) {
  const drawing = drawings[code];
  return drawing.rows.flatMap((row, y) => [...row].flatMap((symbol, x) => {
    const color = drawing.palette[symbol];
    return color ? [{ x: drawing.x + x, y: drawing.y + y, color }] : [];
  }));
}

export function CosmeticSprite({ code }: { code: CosmeticCode }) {
  const { rows, x: avatarX, y: avatarY } = drawings[code];
  const width = rows[0].length;
  const size = Math.max(width, rows.length) + 2;
  const offsetX = Math.floor((size - width) / 2);
  const offsetY = Math.floor((size - rows.length) / 2);

  return (
    <span aria-hidden="true" style={{
      display: "grid",
      width: "100%",
      aspectRatio: "1",
      gridTemplate: `repeat(${size}, 1fr) / repeat(${size}, 1fr)`,
    }}>
      {cosmeticPixels(code).map(({ x, y, color }) => (
        <span key={y * 10 + x} style={{
          backgroundColor: color,
          gridArea: `${y - avatarY + offsetY + 1} / ${x - avatarX + offsetX + 1}`,
        }} />
      ))}
    </span>
  );
}
