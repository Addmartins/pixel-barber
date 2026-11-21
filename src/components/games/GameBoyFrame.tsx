"use client";

import { type PointerEvent, type ReactNode } from "react";
import { A, B, DOWN, LEFT, RIGHT, UP } from "@/lib/games/types";

const directions = [
  { bit: UP, label: "Cima", face: "▲", area: "up" },
  { bit: LEFT, label: "Esquerda", face: "◀", area: "left" },
  { bit: RIGHT, label: "Direita", face: "▶", area: "right" },
  { bit: DOWN, label: "Baixo", face: "▼", area: "down" },
];

const actions = [
  { bit: B, label: "Ação B", face: "B", area: "action-b" },
  { bit: A, label: "Ação A", face: "A", area: "action-a" },
];

export function GameBoyFrame({ children, playing, onInput, onStart, onSelect, startDisabled, selectDisabled }: {
  children: ReactNode;
  playing: boolean;
  onInput: (pointer: number, bit: number) => void;
  onStart: () => void;
  onSelect: () => void;
  startDisabled: boolean;
  selectDisabled: boolean;
}) {
  function press(event: PointerEvent<HTMLButtonElement>, bit: number) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    onInput(event.pointerId, bit);
  }

  function release(event: PointerEvent<HTMLButtonElement>) {
    onInput(event.pointerId, 0);
  }

  function renderButton({ bit, label, face, area }: (typeof directions)[number]) {
    return (
      <button key={bit} type="button" data-area={area} aria-label={label} disabled={!playing}
        onPointerDown={(event) => press(event, bit)} onPointerUp={release}
        onPointerCancel={release} onLostPointerCapture={release}
        onKeyDown={(event) => {
          if (event.key !== " ") return;
          event.preventDefault();
          onInput(-bit, bit);
        }}
        onKeyUp={(event) => {
          if (event.key === " ") onInput(-bit, 0);
        }}
        onBlur={() => onInput(-bit, 0)}>
        {face}
      </button>
    );
  }

  return (
    <div className="pixel-boy">
      <div className="pixel-boy-bezel">
        <div className="pixel-boy-bezel-caption">DOT MATRIX WITH STEREO SOUND</div>
        <div className="pixel-boy-screen">
          <div className="pixel-boy-battery" aria-hidden="true"><span />BATTERY</div>
          {children}
        </div>
      </div>
      <div className="pixel-boy-brand" aria-label="Pixel Boy">PIXEL<span>BOY</span></div>
      <div className="pixel-boy-controls" role="group" aria-label="Controles do Pixel Boy">
        <div className="pixel-boy-dpad">{directions.map(renderButton)}</div>
        <div className="pixel-boy-actions">{actions.map(renderButton)}</div>
      </div>
      <div className="pixel-boy-footer">
        <div className="pixel-boy-menu">
          <button type="button" aria-keyshortcuts="Shift" onClick={onSelect} disabled={selectDisabled}>SELECT</button>
          <button type="button" aria-keyshortcuts="Enter" onClick={onStart} disabled={startDisabled}>START</button>
        </div>
        <div className="pixel-boy-speaker" aria-hidden="true">
          <span /><span /><span /><span /><span />
        </div>
      </div>
    </div>
  );
}
