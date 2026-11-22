import type { CSSProperties } from "react";

export function BarberChairBack({ launch = false }: { launch?: boolean }) {
  return <g className="layer layer-chair-back">
    <path fill="#151423" d="M7 20H24V22H27V26H29V45H31V50H28V53H19V57H24V60H26V63H6V61H8V58H13V53H4V50H1V44H3V26H5V22H7Z" />
    <path fill={launch ? "#175a66" : "#883956"} d="M8 22H23V24H26V27H27V45H5V27H6V24H8Z" />
    <path fill={launch ? "#e9bf80" : "#d2788c"} d="M8 23H23V25H25V28H26V42H24V28H22V26H9V28H7V42H6V28H7V25H8Z" />
    <path fill={launch ? "#43adac" : "#b9637a"} d="M8 32H10V41H8Z M22 32H24V41H22Z" />
    <path fill={launch ? "#1e3a51" : "#552e48"} d="M6 41H26V45H6Z" />
    <path fill={launch ? "#31616e" : "#a84f6c"} d="M4 46H28V51H26V53H6V51H4Z" />
    <path fill={launch ? "#e9bf80" : "#d2788c"} d="M5 47H27V49H5Z" />
    <path fill="#786e88" d="M14 53H18V58H22V60H24V62H8V61H10V59H14Z" />
    <path fill="#b1a6b5" d="M14 54H16V60H21V61H11V60H14Z" />
    <path fill={launch ? "#e4d0a3" : "#d4c9dc"} d="M5 61H27V63H5Z" />
    {launch && <path className="launch-stitch" d="M4 25V45H8 M27 25V45H24 M7 23H24 M7 62H25"
      fill="none" stroke="#a8fff2" strokeWidth=".7" strokeDasharray="3 4" />}

  </g>;
}

export function SeatedDenim() {
  return <g className="layer layer-seated-denim">
    <path fill="#1a162b" d="M9 46H23V48H25V52H23V55H22V58H25V60H26V62H19V61H17V58H16V55H15V58H14V61H12V62H5V60H6V58H9V55H8V52H7V49H9Z" />
    <path fill="#3f5378" d="M10 47H22V49H24V51H22V54H21V57H18V55H17V52H14V55H13V57H10V54H9V51H8V50H10Z" />
    <path fill="#6a89ae" d="M9 48H14V50H12V52H9Z M18 48H23V49H24V52H21V50H18Z M10 55H13V57H10Z M18 55H21V57H18Z" />
    <path fill="#c9c6ce" d="M9 58H13V60H12V61H6V60H7V59H9Z M18 58H22V59H24V60H25V61H19V60H18Z" />
    <path fill="#fff4dd" d="M7 60H12V61H7Z M20 60H24V61H20Z" />
  </g>;
}

export function BarberChairArms({ launch = false }: { launch?: boolean }) {
  return <g className="layer layer-chair-arms">
    <path fill="#201a2e" d="M1 41H7V42H10V46H8V51H6V46H2V45H1Z M25 41H31V45H30V46H27V51H25V46H23V43H25Z" />
    <path fill={launch ? "#ab866a" : "#b9909d"} d="M2 42H7V43H9V45H2Z M25 42H30V45H24V44H25Z" />
    <path fill="#6e596e" d="M6 46H8V50H6Z M25 46H27V50H25Z" />
    <path fill={launch ? "#ffe2ab" : "#f1c3c2"} d="M3 42H7V43H3Z M26 42H30V43H26Z M2 44H8V45H2Z M24 44H30V45H24Z" />
  </g>;
}

const orbit = [[16, 3, 0], [28, 17, -2], [27, 48, -4], [5, 47, -6]] as const;

export function BladeAura({ launch = false }: { launch?: boolean }) {
  return <g className="layer layer-blade-aura" data-edition={launch ? "launch" : undefined}>
    {launch && <ellipse className="launch-stitch" cx="16" cy="31" rx="13.7" ry="29" fill="none"
      stroke="#9cf9e9" strokeWidth=".65" strokeDasharray="4 7" opacity=".9" />}
    <ellipse cx="16" cy="31" rx="12.5" ry="28" fill="none" stroke={launch ? "#cf84e0" : "#9183ed"} strokeWidth=".5" opacity=".45" />
    {orbit.map(([x, y, delay]) => (
      <g key={delay} className="cosmetic-avatar-orbit" transform={`translate(${x} ${y})`}
        style={{ "--orbit-delay": `${delay}s` } as CSSProperties}>
        {launch ? <>
          <path fill="#334d75" d="M0-4 3-2 4 0 2 3 0 4-3 2-4 0-2-3Z" />
          <path fill={delay % 4 === 0 ? "#9af8e0" : "#d9a5ff"} d="M0-3 3 0 0 3-3 0Z" />
          <path fill="#f1fff7" d="M0-2 1-1 0 0-1-1Z" />
        </> : <>
        <path fill="#282044" d="M-2 -3H1V-2H3V1H2V3H-1V2H-3V-1H-2Z" />
        <path fill="#8c83ef" d="M-1 -2H1V-1H2V1H1V2H-1V1H-2V0H-1Z" />
        <path fill="#d5faff" d="M-1 -2H1V-1H2V0H0V-1H-1Z M-1 1H0V2H-1Z" />
        </>}
      </g>
    ))}
  </g>;
}
