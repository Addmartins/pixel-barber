"use client";

import { type PointerEvent, type ReactNode } from "react";
import { A, B, DOWN, LEFT, RIGHT, UP } from "@/lib/games/types";

const buttons = [
  { bit: UP, label: "Cima", face: "▲", area: "up" },
  { bit: LEFT, label: "Esquerda", face: "◀", area: "left" },
  { bit: RIGHT, label: "Direita", face: "▶", area: "right" },
  { bit: DOWN, label: "Baixo", face: "▼", area: "down" },
  { bit: A, label: "Ação A", face: "A", area: "action-a" },
  { bit: B, label: "Ação B", face: "B", area: "action-b" },
];

export function ArcadeFrame({ children, playing, onInput }: {
  children: ReactNode;
  playing: boolean;
  onInput: (pointer: number, bit: number) => void;
}) {
  function press(event: PointerEvent<HTMLButtonElement>, bit: number) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    onInput(event.pointerId, bit);
  }
  function release(event: PointerEvent<HTMLButtonElement>) {
    onInput(event.pointerId, 0);
  }

  return (
    <div className="arcade-cabinet">
      {children}
      <div className="arcade-controls" role="group" aria-label="Controles do fliperama">
        {buttons.map(({ bit, label, face, area }) => (
          <button key={bit} type="button" data-area={area} aria-label={label} disabled={!playing}
            onPointerDown={(event) => press(event, bit)} onPointerUp={release}
            onPointerCancel={release} onLostPointerCapture={release}
            onKeyDown={(event) => {
              if (event.key !== " " && event.key !== "Enter") return;
              event.preventDefault();
              onInput(-bit, bit);
            }}
            onKeyUp={(event) => {
              if (event.key === " " || event.key === "Enter") onInput(-bit, 0);
            }}
            onBlur={() => onInput(-bit, 0)}>
            {face}
          </button>
        ))}
      </div>
    </div>
  );
}
