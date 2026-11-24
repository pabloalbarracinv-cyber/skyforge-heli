import React from 'react';
import { Award, Flag, RotateCcw, Star, Trophy } from 'lucide-react';
import type { MissionLiveStatus } from '../missions/MissionSystem';
import { MISSIONS } from '../missions/MissionSystem';
import { formatClock } from './formatters';

interface MissionOverlayProps {
  mission: MissionLiveStatus;
  onRestart: () => void;
  onReturnMenu: () => void;
}

export const MissionOverlay: React.FC<MissionOverlayProps> = ({
  mission,
  onRestart,
  onReturnMenu,
}) => {
  const def = MISSIONS.find((m) => m.id === mission.missionId) ?? MISSIONS[0];

  return (
    <>
      {/* Tarjeta flotante de objetivo activo arriba a la izquierda/centro */}
      <div className="pointer-events-none fixed top-16 left-3 sm:left-5 z-20 max-w-sm select-none">
        <div className="hud-glass rounded-2xl px-4 py-2.5 text-[#F6F1E6]">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-300">
              <Flag className="h-3.5 w-3.5" />
              {def.title}
            </span>
            {mission.missionId !== 'free_flight' && (
              <span className="font-mono-tech text-xs font-bold text-white">
                {formatClock(mission.elapsedSec)}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-200 leading-snug">{mission.objectiveText}</p>

          {mission.progressTotal > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <div className="h-1.5 flex-1 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-emerald-400 transition-all"
                  style={{
                    width: `${Math.min(
                      100,
                      ((mission.progressCurrent + mission.rescueHoldProgress) /
                        mission.progressTotal) *
                        100
                    )}%`,
                  }}
                />
              </div>
              <span className="font-mono-tech text-[10px] text-slate-300">
                {mission.progressCurrent}/{mission.progressTotal}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Resultado (Victoria o Accidente) estilo Picasso Tech */}
      {(mission.completed || mission.failed) && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="paper-card w-full max-w-md rounded-3xl p-7 text-[#1A202C] shadow-2xl">
            <div className="flex items-center justify-between">
              <span className="font-hand text-2xl text-[#B85D19]">
                {mission.completed ? 'Cuaderno de Vuelo — Éxito' : 'Informe de Incidente'}
              </span>
              {mission.completed ? (
                <Trophy className="h-7 w-7 text-[#1E4B85]" />
              ) : (
                <Award className="h-7 w-7 text-rose-700" />
              )}
            </div>

            <h2 className="mt-1 font-serif-editorial text-3xl font-bold text-[#1A202C]">
              {mission.completed ? '¡Misión Completada!' : 'Aeronave Dañada'}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {mission.completed
                ? `Has completado "${def.title}" con precisión aeronáutica.`
                : (mission.failReason ?? 'Impacto estructural durante la maniobra.')}
            </p>

            {mission.completed && mission.missionId !== 'free_flight' && (
              <div className="mt-5 rounded-2xl border border-[#1E4B85]/15 bg-[#F6F1E6] p-4">
                <div className="flex items-center justify-center gap-2">
                  {[1, 2, 3].map((s) => (
                    <Star
                      key={s}
                      className={`h-8 w-8 ${
                        s <= mission.stars
                          ? 'fill-amber-500 text-amber-500'
                          : 'text-slate-300'
                      }`}
                    />
                  ))}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-center">
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-slate-500">
                      Tiempo Final
                    </div>
                    <div className="font-mono-tech text-xl font-bold text-[#1E4B85]">
                      {formatClock(mission.elapsedSec)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-slate-500">
                      Puntuación
                    </div>
                    <div className="font-mono-tech text-xl font-bold text-[#B85D19]">
                      {mission.score} pts
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                onClick={onRestart}
                className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[#1E4B85] px-5 py-3 text-sm font-semibold text-white hover:bg-[#163a69] transition cursor-pointer"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Volar de Nuevo</span>
              </button>
              <button
                type="button"
                onClick={onReturnMenu}
                className="rounded-full border border-[#1E4B85]/30 px-5 py-3 text-sm font-semibold text-[#1E4B85] hover:bg-[#1E4B85]/10 transition cursor-pointer"
              >
                Hangar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
