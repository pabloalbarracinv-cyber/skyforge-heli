import React from 'react';
import type { SimHudState } from '../../engine/SimStore';

interface CockpitPanelProps {
  hud: SimHudState;
}

// Tablero de instrumentos analógicos aeronáuticos SVG para la cámara de Cabina:
// 1. Anemómetro (Nudos) | 2. Horizonte Artificial (Pitch/Roll) | 3. Altímetro de doble aguja (Pies) | 4. Variómetro (VSI) | 5. Tacómetro Dual Rotor/Torque
export const CockpitPanel: React.FC<CockpitPanelProps> = ({ hud }) => {
  if (hud.cameraMode !== 'cockpit') return null;

  const knots = hud.airSpeedMs * 1.94384;
  const altFeet = hud.aglMeters * 3.28084;
  const vsiFpm = hud.verticalSpeedMs * 196.85;

  // Ángulos de agujas
  const airspeedAngle = -140 + Math.min(160, Math.max(0, knots)) * 1.75; // 0..160 kt
  const alt100Angle = ((altFeet % 1000) / 1000) * 360;
  const alt1000Angle = ((altFeet % 10000) / 10000) * 360;
  const vsiAngle = Math.max(-135, Math.min(135, (vsiFpm / 2000) * 135));
  const rpmAngle = -120 + Math.min(120, hud.rotorRpmPercent) * 2.0;
  const trqAngle = -120 + Math.min(120, hud.torquePercent) * 2.0;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-10 flex flex-col items-center select-none">
      {/* Marco superior sutil del parabrisas */}
      <div className="fixed inset-x-0 top-0 h-10 bg-gradient-to-b from-slate-950/75 to-transparent" />

      {/* Consola de instrumentos H125 */}
      <div className="w-full max-w-4xl rounded-t-3xl border-t-2 border-x-2 border-slate-700/90 bg-gradient-to-b from-[#1b222c] to-[#0f141b] px-4 py-3 shadow-[0_-15px_40px_rgba(0,0,0,0.65)]">
        <div className="grid grid-cols-5 gap-2 sm:gap-4 items-center justify-items-center">
          {/* 1. Anemómetro (IAS KT) */}
          <GaugeDial label="AIRSPEED" sub="KNOTS">
            <circle cx="50" cy="50" r="42" fill="#0b0f14" stroke="#475569" strokeWidth="2.5" />
            {[0, 20, 40, 60, 80, 100, 120, 140].map((v) => {
              const a = ((-140 + v * 1.75 - 90) * Math.PI) / 180;
              return (
                <g key={v}>
                  <line
                    x1={50 + Math.cos(a) * 34}
                    y1={50 + Math.sin(a) * 34}
                    x2={50 + Math.cos(a) * 40}
                    y2={50 + Math.sin(a) * 40}
                    stroke="#e2e8f0"
                    strokeWidth="1.5"
                  />
                  <text
                    x={50 + Math.cos(a) * 26}
                    y={50 + Math.sin(a) * 26 + 2.5}
                    fill="#cbd5e1"
                    fontSize="6.5"
                    textAnchor="middle"
                  >
                    {v}
                  </text>
                </g>
              );
            })}
            <g transform={`rotate(${airspeedAngle} 50 50)`}>
              <line x1="50" y1="54" x2="50" y2="15" stroke="#f8fafc" strokeWidth="2.2" strokeLinecap="round" />
            </g>
            <circle cx="50" cy="50" r="4" fill="#f59e0b" />
          </GaugeDial>

          {/* 2. Horizonte Artificial (ADI) */}
          <GaugeDial label="ATTITUDE" sub={`${Math.round(hud.headingDeg).toString().padStart(3, '0')}° HDG`}>
            <defs>
              <clipPath id="adi-clip">
                <circle cx="50" cy="50" r="40" />
              </clipPath>
            </defs>
            <g clipPath="url(#adi-clip)">
              <g transform={`rotate(${-hud.rollDeg} 50 50) translate(0 ${hud.pitchDeg * 0.95})`}>
                <rect x="-20" y="-40" width="140" height="90" fill="#1d6fa5" />
                <rect x="-20" y="50" width="140" height="90" fill="#6b4c35" />
                <line x1="-10" y1="50" x2="110" y2="50" stroke="#f8fafc" strokeWidth="1.8" />
                {[-20, -10, 10, 20].map((p) => (
                  <line
                    key={p}
                    x1="40"
                    y1={50 - p * 0.95}
                    x2="60"
                    y2={50 - p * 0.95}
                    stroke="#f8fafc"
                    strokeWidth="1"
                  />
                ))}
              </g>
            </g>
            {/* Alas fijas de referencia */}
            <path d="M26 50 H41 L44 54 M74 50 H59 L56 54" stroke="#f59e0b" strokeWidth="2.4" fill="none" />
            <circle cx="50" cy="50" r="2.2" fill="#f59e0b" />
            <circle cx="50" cy="50" r="41" fill="none" stroke="#64748b" strokeWidth="2.5" />
          </GaugeDial>

          {/* 3. Altímetro Analógico */}
          <GaugeDial label="ALTITUDE" sub={`${Math.round(altFeet)} FT AGL`}>
            <circle cx="50" cy="50" r="42" fill="#0b0f14" stroke="#475569" strokeWidth="2.5" />
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => {
              const a = ((n * 36 - 90) * Math.PI) / 180;
              return (
                <g key={n}>
                  <line
                    x1={50 + Math.cos(a) * 34}
                    y1={50 + Math.sin(a) * 34}
                    x2={50 + Math.cos(a) * 40}
                    y2={50 + Math.sin(a) * 40}
                    stroke="#e2e8f0"
                    strokeWidth="1.5"
                  />
                  <text
                    x={50 + Math.cos(a) * 26}
                    y={50 + Math.sin(a) * 26 + 3}
                    fill="#e2e8f0"
                    fontSize="7.5"
                    textAnchor="middle"
                  >
                    {n}
                  </text>
                </g>
              );
            })}
            {/* Aguja miles (corta ancha) */}
            <g transform={`rotate(${alt1000Angle} 50 50)`}>
              <line x1="50" y1="50" x2="50" y2="26" stroke="#94a3b8" strokeWidth="3.5" strokeLinecap="round" />
            </g>
            {/* Aguja centenas (larga fina) */}
            <g transform={`rotate(${alt100Angle} 50 50)`}>
              <line x1="50" y1="54" x2="50" y2="14" stroke="#f8fafc" strokeWidth="1.8" strokeLinecap="round" />
            </g>
            <circle cx="50" cy="50" r="4" fill="#f59e0b" />
          </GaugeDial>

          {/* 4. Variómetro (Vertical Speed) */}
          <GaugeDial label="VERT SPEED" sub={`${Math.round(vsiFpm / 10) * 10} FPM`}>
            <circle cx="50" cy="50" r="42" fill="#0b0f14" stroke="#475569" strokeWidth="2.5" />
            {[-2, -1, 0, 1, 2].map((k) => {
              const deg = 180 + (k / 2) * 135;
              const rad = (deg * Math.PI) / 180;
              return (
                <g key={k}>
                  <line
                    x1={50 + Math.cos(rad) * 33}
                    y1={50 + Math.sin(rad) * 33}
                    x2={50 + Math.cos(rad) * 40}
                    y2={50 + Math.sin(rad) * 40}
                    stroke="#cbd5e1"
                    strokeWidth="1.6"
                  />
                  <text
                    x={50 + Math.cos(rad) * 25}
                    y={50 + Math.sin(rad) * 25 + 2.5}
                    fill="#cbd5e1"
                    fontSize="7"
                    textAnchor="middle"
                  >
                    {Math.abs(k)}
                  </text>
                </g>
              );
            })}
            <g transform={`rotate(${vsiAngle - 90} 50 50)`}>
              <line x1="50" y1="53" x2="50" y2="16" stroke="#34d399" strokeWidth="2.2" strokeLinecap="round" />
            </g>
            <circle cx="50" cy="50" r="4" fill="#f59e0b" />
          </GaugeDial>

          {/* 5. Rotor RPM & Torque */}
          <GaugeDial label="NR / TRQ" sub={`COL ${Math.round(hud.collective * 100)}%`}>
            <circle cx="50" cy="50" r="42" fill="#0b0f14" stroke="#475569" strokeWidth="2.5" />
            {/* Arco verde nominal */}
            <circle
              cx="50"
              cy="50"
              r="36"
              fill="none"
              stroke="#10b981"
              strokeWidth="3"
              strokeDasharray="40 220"
              transform="rotate(-25 50 50)"
            />
            <g transform={`rotate(${rpmAngle} 50 50)`}>
              <line x1="50" y1="50" x2="50" y2="16" stroke="#10b981" strokeWidth="2.4" />
            </g>
            <g transform={`rotate(${trqAngle} 50 50)`}>
              <line x1="50" y1="50" x2="50" y2="21" stroke="#f59e0b" strokeWidth="1.8" />
            </g>
            <circle cx="50" cy="50" r="4" fill="#e2e8f0" />
            <text x="50" y="74" fill="#94a3b8" fontSize="6.5" textAnchor="middle">
              TRQ {Math.round(hud.torquePercent)}%
            </text>
          </GaugeDial>
        </div>
      </div>
    </div>
  );
};

const GaugeDial: React.FC<{ label: string; sub: string; children: React.ReactNode }> = ({
  label,
  sub,
  children,
}) => (
  <div className="flex flex-col items-center">
    <svg viewBox="0 0 100 100" className="h-20 w-20 sm:h-28 sm:w-28 drop-shadow">
      {children}
    </svg>
    <span className="mt-0.5 font-mono-tech text-[9px] sm:text-[10px] font-semibold tracking-wider text-slate-300">
      {label}
    </span>
    <span className="font-mono-tech text-[9px] text-amber-300/90">{sub}</span>
  </div>
);
