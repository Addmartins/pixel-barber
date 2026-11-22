const pictures = {
  summit: ["....xx..", "...xxx..", "...x....", "..xxx...", "..xx.xx.", ".x.xx.x.", "xxxxx.xx", "xxxxxxxx"],
  whisker: ["........", "..xxxx..", ".xx..xx.", "..x...xx", "..x..xxx", ".xx.xxx.", "xxxx....", "........"],
  sprout: [".....xx.", "..x.xxx.", "..xxxx..", "...xx...", "...x....", ".xxxxxx.", "..xxxx..", "..xxxx.."],
};

function Art({ picture }: { picture: keyof typeof pictures }) {
  return (
    <svg viewBox="0 0 8 8" width="24" height="24" fill="currentColor" shapeRendering="crispEdges" aria-hidden="true">
      {pictures[picture].flatMap((row, y) => Array.from(row, (pixel, x) =>
        pixel === "x" ? <rect key={y * 8 + x} x={x} y={y} width="1" height="1" /> : null))}
    </svg>
  );
}

export function SummitArt() { return <Art picture="summit" />; }
export function WhiskerArt() { return <Art picture="whisker" />; }
export function SproutArt() { return <Art picture="sprout" />; }
