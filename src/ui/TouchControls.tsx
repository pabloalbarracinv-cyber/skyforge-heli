import React, { useRef, useState } from 'react';
import type { TouchSource } from '../input/TouchSource';

interface TouchControlsProps {
  touchSource: TouchSource;
  visible: boolean;
  assistedMode: boolean;
  onGround: boolean;
}

// Dos joysticks táctiles ergonómicos para móviles y tablets:
// - Izquierdo: Colectivo (arriba/abajo) + Pedales de cola (izquierda/derecha)
// - Derecho: Cíclico (alabeo y cabeceo)
export const TouchControls: React.FC<TouchControlsProps> = ({
  touchSource,
  visible,
  assistedMode,
  onGround,
}) => {
  const leftRef = useRef<HTMLDivElement | null>(null);
  const rightRef = useRef<HTMLDivElement | null>(null);
  const [leftKnob, setLeftKnob] = useState({ x: 0, y: 0 });
  const [rightKnob, setRightKnob] = useState({ x: 0, y: 0 });

  if (!visible) return null;

  const radius = 48;

  const handleLeftMove = (clientX: number, clientY: number) => {
    const el = leftRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const dx = Math.max(-radius, Math.min(radius, clientX - (rect.left + rect.width / 2)));
    const dy = Math.max(-radius, Math.min(radius, clientY - (rect.top + rect.height / 2)));
    setLeftKnob({ x: dx, y: dy });

    const yaw = dx / radius;
    const collective = 0.5 - (dy / radius) * 0.5;
    touchSource.setLeftStick(yaw, collective, true);
  };

  const handleRightMove = (clientX: number, clientY: number) => {
    const el = rightRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const dx = Math.max(-radius, Math.min(radius, clientX - (rect.left + rect.width / 2)));
    const dy = Math.max(-radius, Math.min(radius, clientY - (rect.top + rect.height / 2)));
    setRightKnob({ x: dx, y: dy });

    const roll = dx / radius;
    const pitch = -dy / radius;
    touchSource.setCyclic(roll, pitch, true);
  };

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-44 sm:bottom-36 z-30 flex items-center justify-between px-4 sm:px-10 select-none touch-none"
      data-ui-interactive="true"
    >
      {/* Pad Izquierdo: Colectivo + Yaw */}
      <div
        ref={leftRef}
        data-ui-interactive="true"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          handleLeftMove(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (e.buttons > 0) handleLeftMove(e.clientX, e.clientY);
        }}
        onPointerUp={() => {
          setLeftKnob({ x: 0, y: assistedMode && !onGround ? 0 : leftKnob.y });
          touchSource.releaseTouch(assistedMode, onGround);
        }}
        className="pointer-events-auto relative flex h-28 w-28 items-center justify-center rounded-full border border-white/30 bg-slate-900/50 backdrop-blur-md"
      >
        <span className="absolute -top-5 text-[10px] font-mono-tech uppercase tracking-wider text-amber-200">
          COL / YAW
        </span>
        <div
          className="h-11 w-11 rounded-full bg-amber-400/85 border-2 border-white shadow-lg"
          style={{ transform: `translate(${leftKnob.x}px, ${leftKnob.y}px)` }}
        />
      </div>

      {/* Pad Derecho: Cíclico */}
      <div
        ref={rightRef}
        data-ui-interactive="true"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          handleRightMove(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (e.buttons > 0) handleRightMove(e.clientX, e.clientY);
        }}
        onPointerUp={() => {
          setRightKnob({ x: 0, y: 0 });
          touchSource.setCyclic(0, 0, false);
        }}
        className="pointer-events-auto relative flex h-28 w-28 items-center justify-center rounded-full border border-white/30 bg-slate-900/50 backdrop-blur-md"
      >
        <span className="absolute -top-5 text-[10px] font-mono-tech uppercase tracking-wider text-sky-200">
          CÍCLICO
        </span>
        <div
          className="h-11 w-11 rounded-full bg-sky-400/85 border-2 border-white shadow-lg"
          style={{ transform: `translate(${rightKnob.x}px, ${rightKnob.y}px)` }}
        />
      </div>
    </div>
  );
};
