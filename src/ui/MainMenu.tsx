import React from 'react';
import { Compass, HelpCircle, Play, Shield, Sliders, Sparkles, Star } from 'lucide-react';
import { MISSIONS } from '../missions/MissionSystem';
import type { MissionId, MissionRecord, UserSettings } from '../persistence/SaveStore';
import { formatClock } from './formatters';

interface MainMenuProps {
  settings: UserSettings;
  records: Record<string, MissionRecord>;
  hasActiveSession: boolean;
  onSelectMission: (id: MissionId) => void;
  onResumeSession: () => void;
  onToggleFlightMode: () => void;
  onOpenControls: () => void;
  onOpenSettings: () => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({
  settings,
  records,
  hasActiveSession,
  onSelectMission,
  onResumeSession,
  onToggleFlightMode,
  onOpenControls,
  onOpenSettings,
}) => {
  return (
    <div className="fixed inset-0 z-30 overflow-y-auto bg-parchment-grid/95 backdrop-blur-md text-[#1A202C]">
      <div className="mx-auto flex min-h-full max-w-6xl flex-col justify-between px-5 py-7 sm:px-10 sm:py-10">
        {/* Encabezado Editorial Picasso Tech */}
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#1E4B85]/15 pb-5">
          <div>
            <span className="font-hand text-2xl text-[#B85D19]">
              Laboratorio Aeronáutico · Cuaderno N.º 01
            </span>
            <h1 className="font-serif-editorial text-4xl sm:text-5xl font-bold tracking-tight text-[#1A202C]">
              SkyForge <span className="italic text-[#1E4B85]">Heli</span>
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={onToggleFlightMode}
              className="flex items-center gap-2 rounded-full border border-[#1E4B85]/25 bg-white/80 px-4 py-2 text-xs font-semibold text-[#1E4B85] shadow-sm hover:bg-white transition cursor-pointer"
            >
              <Shield className="h-4 w-4 text-[#B85D19]" />
              <span>
                Física:{' '}
                {settings.flightMode === 'assisted'
                  ? 'Asistida (Accesible)'
                  : 'Realista (Rotor Puro)'}
              </span>
            </button>

            <button
              type="button"
              onClick={onOpenControls}
              className="flex items-center gap-1.5 rounded-full border border-[#1E4B85]/25 bg-white/80 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-white transition cursor-pointer"
            >
              <HelpCircle className="h-4 w-4 text-[#1E4B85]" />
              <span>Controles</span>
            </button>

            <button
              type="button"
              onClick={onOpenSettings}
              className="flex items-center gap-1.5 rounded-full border border-[#1E4B85]/25 bg-white/80 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-white transition cursor-pointer"
            >
              <Sliders className="h-4 w-4 text-[#1E4B85]" />
              <span>Ajustes</span>
            </button>
          </div>
        </header>

        {/* Cuerpo Principal Asimétrico */}
        <main className="my-8 grid gap-8 lg:grid-cols-12 items-start">
          {/* Columna Narrativa y Ficha Técnica SF-125 */}
          <section className="lg:col-span-5 space-y-5">
            <div className="paper-card rounded-3xl p-6 sm:p-7">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-[#1E4B85]/10 px-3 py-1 font-mono-tech text-[11px] font-semibold text-[#1E4B85]">
                <Sparkles className="h-3.5 w-3.5" /> AERODINÁMICA EN TIEMPO REAL · 120 HZ
              </div>

              <h2 className="mt-3 font-serif-editorial text-3xl font-bold leading-tight text-[#1A202C]">
                Domina el arte del vuelo estacionario y de montaña.
              </h2>

              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                Aquí sientes cómo el rotor muerde el aire: efecto suelo al despegar, ganancia
                traslacional al acelerar y par reactivo en los pedales. Conecta teclado, mando,
                joystick HOTAS o pantalla táctil y despega al instante.
              </p>

              {/* Especificaciones de ingeniería */}
              <div className="mt-5 grid grid-cols-3 gap-2.5 rounded-2xl border border-[#1E4B85]/15 bg-[#F6F1E6] p-3.5 text-center font-mono-tech">
                <div>
                  <div className="text-[10px] text-slate-500">AERONAVE</div>
                  <div className="text-xs font-bold text-[#1E4B85]">SF-125</div>
                </div>
                <div className="border-x border-[#1E4B85]/15">
                  <div className="text-[10px] text-slate-500">DIÁM. ROTOR</div>
                  <div className="text-xs font-bold text-[#1E4B85]">10.70 m</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500">MASA / POT</div>
                  <div className="text-xs font-bold text-[#B85D19]">1800 kg</div>
                </div>
              </div>

              {hasActiveSession && (
                <button
                  type="button"
                  onClick={onResumeSession}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-emerald-700 px-6 py-3.5 text-sm font-semibold text-white shadow-md hover:bg-emerald-800 transition cursor-pointer"
                >
                  <Play className="h-4 w-4 fill-current" />
                  <span>Reanudar Vuelo en Curso</span>
                </button>
              )}
            </div>

            <div className="rounded-2xl border border-[#1E4B85]/15 bg-white/60 px-5 py-3.5 text-xs text-slate-600">
              <strong className="text-[#1E4B85]">Consejo rápido de despegue:</strong> mantén{' '}
              <code className="rounded bg-slate-200 px-1.5 py-0.5 font-mono-tech">W</code> para
              elevar el colectivo, inclina suavemente con{' '}
              <code className="rounded bg-slate-200 px-1.5 py-0.5 font-mono-tech">↑</code> para
              ganar velocidad y pulsa{' '}
              <code className="rounded bg-slate-200 px-1.5 py-0.5 font-mono-tech">C</code> para
              entrar en la cabina analógica.
            </div>
          </section>

          {/* Columna Selector de Misiones */}
          <section className="lg:col-span-7 space-y-3.5">
            <div className="flex items-center justify-between px-1">
              <h3 className="font-serif-editorial text-2xl font-bold text-[#1A202C] flex items-center gap-2">
                <Compass className="h-5 w-5 text-[#1E4B85]" />
                Plan de Vuelo y Operaciones
              </h3>
              <span className="font-mono-tech text-xs text-slate-500">4 ESCENARIOS · 16 KM²</span>
            </div>

            <div className="grid gap-3.5 sm:grid-cols-2">
              {MISSIONS.map((m) => {
                const rec = records[m.id];
                return (
                  <div
                    key={m.id}
                    className="paper-card group flex flex-col justify-between rounded-3xl p-5 transition hover:-translate-y-0.5 hover:border-[#1E4B85]/45"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="rounded-full bg-[#1E4B85]/10 px-2.5 py-0.5 font-mono-tech text-[10px] font-semibold uppercase text-[#1E4B85]">
                          {m.difficulty}
                        </span>
                        {rec && (
                          <div className="flex items-center gap-0.5">
                            {[1, 2, 3].map((s) => (
                              <Star
                                key={s}
                                className={`h-3.5 w-3.5 ${
                                  s <= rec.stars
                                    ? 'fill-amber-500 text-amber-500'
                                    : 'text-slate-300'
                                }`}
                              />
                            ))}
                          </div>
                        )}
                      </div>

                      <h4 className="mt-2.5 font-serif-editorial text-2xl font-bold leading-snug text-[#1A202C]">
                        {m.title}
                      </h4>
                      <p className="text-xs font-medium text-[#B85D19]">{m.subtitle}</p>
                      <p className="mt-2 text-xs leading-relaxed text-slate-600">{m.description}</p>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-[#1E4B85]/10 pt-3">
                      <div className="font-mono-tech text-[11px] text-slate-500">
                        {rec ? `Récord: ${formatClock(rec.bestTimeSec)}` : 'Sin récord previo'}
                      </div>
                      <button
                        type="button"
                        onClick={() => onSelectMission(m.id)}
                        className="flex items-center gap-1.5 rounded-full bg-[#1E4B85] px-4 py-2 text-xs font-semibold text-white group-hover:bg-[#B85D19] transition cursor-pointer"
                      >
                        <Play className="h-3.5 w-3.5 fill-current" />
                        <span>Despegar</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </main>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-[#1E4B85]/15 pt-4 text-xs text-slate-500">
          <span>SkyForge Heli · Simulación Física Three.js + Web Audio Procedural</span>
          <span className="font-mono-tech">
            Autodetección: Teclado · Gamepad · HOTAS · Táctil · Ratón
          </span>
        </footer>
      </div>
    </div>
  );
};
