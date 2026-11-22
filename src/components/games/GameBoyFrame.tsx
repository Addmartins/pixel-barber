"use client";

import { useRef, useState, type PointerEvent, type ReactNode } from "react";
import { Settings2 } from "lucide-react";
import { A, DOWN, LEFT, RIGHT, UP } from "@/lib/games/types";

const directions = [
  { bit: UP, label: "Cima", face: "▲", area: "up" },
  { bit: LEFT, label: "Esquerda", face: "◀", area: "left" },
  { bit: RIGHT, label: "Direita", face: "▶", area: "right" },
  { bit: DOWN, label: "Baixo", face: "▼", area: "down" },
];


export function radialDirection(dx: number, dy: number) {
  if (dx * dx + dy * dy <= 144) return 0;
  const sector = Math.floor((Math.atan2(dy, dx) * 180 / Math.PI + 405) / 90) % 4;
  return [RIGHT, DOWN, LEFT, UP][sector];
}

export function GameBoyFrame({ children, playing, onInput, onStart, onSelect, startDisabled, selectDisabled,
  onExit, exitDisabled, onMenu, menuOpen, action, directionsMode, directionPriority }: {
  children: ReactNode;
  action?: string;
  directionPriority?: boolean;
  directionsMode: "all" | "horizontal" | "none";
  playing: boolean;
  onInput: (pointer: number, bit: number) => void;
  onStart: () => void;
  onSelect: () => void;
  startDisabled: boolean;
  selectDisabled: boolean;
  onExit: () => void;
  exitDisabled: boolean;
  onMenu: () => void;
  menuOpen: boolean;
}) {
  const padPointer = useRef<number | null>(null);
  const [active, setActive] = useState(0);
  const anchor = useRef<{ x: number; y: number; bit: number } | null>(null);

  function sweep(event: PointerEvent<HTMLDivElement>) {
    if (!playing || padPointer.current !== event.pointerId) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = event.clientX;
    const y = event.clientY;
    const previous = anchor.current;
    const onButton = event.type === "pointerdown" && event.target instanceof HTMLElement
      ? Number(event.target.closest("button")?.dataset.bit ?? 0) : 0;
    const direction = onButton || radialDirection(x - bounds.left - bounds.width / 2, y - bounds.top - bounds.height / 2);
    if (previous && (previous.bit === direction || Math.hypot(x - previous.x, y - previous.y) < 12)) return;
    anchor.current = { x, y, bit: direction };
    setActive(direction);
    onInput(event.pointerId, direction);
  }

  function releasePad(event: PointerEvent<HTMLDivElement>) {
    if (padPointer.current !== event.pointerId) return;
    padPointer.current = null;
    anchor.current = null;
    setActive(0);
    onInput(event.pointerId, 0);
  }

  return (
    <div className="pixel-boy" data-playing={playing} data-direction-priority={directionPriority}>
      <div className="pixel-boy-top">
        <button type="button" className="pixel-boy-power" onClick={onExit} disabled={exitDisabled} aria-label="Power: sair do jogo">POWER</button>
        <div className="pixel-boy-brand" aria-label="Pixel Boy">PIXEL<span>BOY</span></div>
        <button type="button" className="pixel-boy-options" aria-label="Opções do jogo" aria-expanded={menuOpen} onClick={onMenu}>
          <Settings2 size={20} aria-hidden="true" />
        </button>
      </div>
      <div className="pixel-boy-bezel">
        <div className="pixel-boy-screen">{children}</div>
      </div>
      <div className="pixel-boy-controls" role="group" aria-label="Controles do Pixel Boy">
        {directionsMode === "horizontal" && directionPriority ? (
          <div className="pixel-boy-steering" role="group" aria-label="Mover a pomada">
            {directions.filter(({ bit }) => bit === LEFT || bit === RIGHT).map(({ bit, label, face }) => (
              <button key={bit} type="button" aria-label={label} disabled={!playing}
                onPointerDown={(event) => {
                  if (event.button !== 0) return;
                  event.preventDefault();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  onInput(event.pointerId, bit);
                }}
                onPointerUp={(event) => onInput(event.pointerId, 0)}
                onPointerCancel={(event) => onInput(event.pointerId, 0)}
                onLostPointerCapture={(event) => onInput(event.pointerId, 0)}
                onKeyDown={(event) => { if (event.key === " ") { event.preventDefault(); onInput(-bit, bit); } }}
                onKeyUp={(event) => { if (event.key === " ") onInput(-bit, 0); }}
                onBlur={() => onInput(-bit, 0)}>{face}</button>
            ))}
          </div>
        ) : directionsMode !== "none" && <div className="pixel-boy-dpad" data-layout={directionsMode} role="group" aria-label="Direcional"
          onPointerDown={(event) => {
            if (!playing || event.button !== 0 || padPointer.current !== null) return;
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            padPointer.current = event.pointerId;
            sweep(event);
          }}
          onPointerMove={sweep} onPointerUp={releasePad}
          onPointerCancel={releasePad} onLostPointerCapture={releasePad}>
          {directions.filter(({ bit }) => directionsMode === "all" || bit === LEFT || bit === RIGHT).map(({ bit, label, face, area }) => (
            <button key={bit} type="button" data-area={area} data-bit={bit} data-active={playing && active === bit}
              aria-label={label} disabled={!playing}
              onKeyDown={(event) => {
                if (event.key !== " ") return;
                event.preventDefault();
                onInput(-bit, bit);
              }}
              onKeyUp={(event) => { if (event.key === " ") onInput(-bit, 0); }}
              onBlur={() => onInput(-bit, 0)}>{face}</button>
          ))}
        </div>}
        {action && <div className="pixel-boy-actions">
            <button type="button" disabled={!playing}
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                event.preventDefault();
                event.currentTarget.setPointerCapture(event.pointerId);
                onInput(event.pointerId, A);
              }}
              onPointerUp={(event) => onInput(event.pointerId, 0)}
              onPointerCancel={(event) => onInput(event.pointerId, 0)}
              onLostPointerCapture={(event) => onInput(event.pointerId, 0)}
              onKeyDown={(event) => {
                if (event.key !== " ") return;
                event.preventDefault();
                onInput(-A, A);
              }}
              onKeyUp={(event) => { if (event.key === " ") onInput(-A, 0); }}
              onBlur={() => onInput(-A, 0)}>{action}</button>
        </div>}
      </div>
      <div className="pixel-boy-footer">
        <div className="pixel-boy-menu">
          <button type="button" aria-keyshortcuts="Shift" onClick={onSelect} disabled={selectDisabled}>SELECT</button>
          <button type="button" aria-keyshortcuts="Enter" onClick={onStart} disabled={startDisabled}>START</button>
        </div>

      </div>
    </div>
  );
}
