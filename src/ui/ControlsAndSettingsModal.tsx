import React from 'react';
import { Sliders, X } from 'lucide-react';
import type { QualityPreset } from '../engine/Quality';
import type { UnitSystem, UserSettings } from '../persistence/SaveStore';
import type { FlightMode } from '../physics/FlightAssist';

interface ControlsAndSettingsModalProps {
  open: boolean;
  tab: 'controls' | 'settings';
  settings: UserSettings;
  onChangeTab: (tab: 'controls' | 'settings') => void;
  onUpdateSettings: (next: UserSettings) => void;
  onClose: () => void;
}

export const ControlsAndSettingsModal: React.FC<ControlsAndSettingsModalProps> = ({
  open,
  tab,
  settings,
  onChangeTab,
  onUpdateSettings,
  onClose,
}) => {
  if (!open) return null;

  const cal = settings.joystickCalibration;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
      <div className="paper-card max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl p-6 sm:p-8 text-[#1A202C]">
        <div className="flex items-center justify-between border-b border-[#1E4B85]/15 pb-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onChangeTab('controls')}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition cursor-pointer ${
                tab === 'controls'
                  ? 'bg-[#1E4B85] text-white'
                  : 'text-[#1E4B85] hover:bg-[#1E4B85]/10'
              }`}
            >
              Controles Multi-Dispositivo
            </button>
            <button
              type="button"
              onClick={() => onChangeTab('settings')}
              className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition cursor-pointer ${
                tab === 'settings'
                  ? 'bg-[#1E4B85] text-white'
                  : 'text-[#1E4B85] hover:bg-[#1E4B85]/10'
              }`}
            >
              <Sliders className="h-3.5 w-3.5" />
              Ajustes y Calibración
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-600 hover:bg-slate-200/70 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {tab === 'controls' ? (
          <div className="mt-5 space-y-4 text-sm">
            <p className="text-slate-600">
              <strong>Detección automática activa:</strong> usa cualquier periférico en cualquier
              momento y el simulador conmutará instantáneamente a él.
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-[#1E4B85]/15 bg-[#F6F1E6] p-4">
                <h4 className="font-serif-editorial text-xl font-bold text-[#1E4B85]">
                  Teclado y Ratón
                </h4>
                <ul className="mt-2 space-y-1.5 font-mono-tech text-xs text-slate-700">
                  <li>
                    <strong>W / S</strong> (o Espacio/Shift): Subir / Bajar Colectivo
                  </li>
                  <li>
                    <strong>Flechas ↑ ↓ ← →</strong> (o I/K/J/L): Cíclico Cabeceo y Alabeo
                  </li>
                  <li>
                    <strong>A / D</strong> (o Q / E): Pedales de Cola (Guiñada)
                  </li>
                  <li>
                    <strong>Tecla V</strong>: Activar Cíclico con Ratón + Rueda Colectivo
                  </li>
                  <li>
                    <strong>Tecla C</strong>: Cambiar Cámara (Exterior / Cabina / Órbita)
                  </li>
                  <li>
                    <strong>Tecla M</strong>: Alternar Modo Asistido / Realista
                  </li>
                  <li>
                    <strong>Tecla R</strong>: Reiniciar en Helipuerto
                  </li>
                </ul>
              </div>

              <div className="rounded-2xl border border-[#1E4B85]/15 bg-[#F6F1E6] p-4">
                <h4 className="font-serif-editorial text-xl font-bold text-[#1E4B85]">
                  Gamepad, HOTAS y Táctil
                </h4>
                <ul className="mt-2 space-y-1.5 font-mono-tech text-xs text-slate-700">
                  <li>
                    <strong>Xbox / PlayStation:</strong> Stick Derecho = Cíclico · Gatillos RT/LT =
                    Colectivo · Stick Izquierdo X = Pedales · Y = Cámara · X = Modo
                  </li>
                  <li>
                    <strong>Joystick / HOTAS:</strong> Palanca X/Y = Cíclico · Twist/Rudder =
                    Pedales · Palanca Gases = Colectivo (configurable en Ajustes)
                  </li>
                  <li>
                    <strong>Móvil / Tablet:</strong> Joysticks virtuales duales en pantalla al
                    detectar toque
                  </li>
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-5 space-y-5 text-sm">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Modelo de Vuelo
                </label>
                <select
                  value={settings.flightMode}
                  onChange={(e) =>
                    onUpdateSettings({ ...settings, flightMode: e.target.value as FlightMode })
                  }
                  className="mt-1.5 w-full rounded-xl border border-[#1E4B85]/25 bg-white px-3 py-2 font-medium"
                >
                  <option value="assisted">Asistido (PID Estabilizado)</option>
                  <option value="realistic">Realista (Puro con Par)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Unidades HUD
                </label>
                <select
                  value={settings.units}
                  onChange={(e) =>
                    onUpdateSettings({ ...settings, units: e.target.value as UnitSystem })
                  }
                  className="mt-1.5 w-full rounded-xl border border-[#1E4B85]/25 bg-white px-3 py-2 font-medium"
                >
                  <option value="aviation">Aeronáuticas (FT / KT / FPM)</option>
                  <option value="metric">Métricas (M / KM/H / M/S)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Calidad Gráfica 3D
                </label>
                <select
                  value={settings.quality}
                  onChange={(e) =>
                    onUpdateSettings({ ...settings, quality: e.target.value as QualityPreset })
                  }
                  className="mt-1.5 w-full rounded-xl border border-[#1E4B85]/25 bg-white px-3 py-2 font-medium"
                >
                  <option value="high">Alta (Sombras 2K + Bosque Denso)</option>
                  <option value="medium">Media (Equilibrada)</option>
                  <option value="low">Móvil / Ligera (60 FPS)</option>
                </select>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold uppercase tracking-wider text-slate-600">
                <span>Volumen Audio Procedural</span>
                <span>{Math.round(settings.masterVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.masterVolume}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, masterVolume: parseFloat(e.target.value) })
                }
                className="mt-1.5 w-full accent-[#1E4B85]"
              />
            </div>

            {/* Calibración de ejes HOTAS */}
            <div className="rounded-2xl border border-[#1E4B85]/15 bg-[#F6F1E6] p-4">
              <h4 className="font-serif-editorial text-lg font-bold text-[#1E4B85]">
                Mapeo de Ejes Joystick / HOTAS
              </h4>
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                {(
                  [
                    ['Eje Alabeo (Roll)', 'rollAxis'],
                    ['Eje Cabeceo (Pitch)', 'pitchAxis'],
                    ['Eje Pedales (Yaw)', 'yawAxis'],
                    ['Eje Colectivo', 'collectiveAxis'],
                  ] as const
                ).map(([label, key]) => (
                  <div key={key}>
                    <span className="text-slate-600">{label}</span>
                    <input
                      type="number"
                      min={0}
                      max={7}
                      value={cal[key]}
                      onChange={(e) =>
                        onUpdateSettings({
                          ...settings,
                          joystickCalibration: {
                            ...cal,
                            [key]: Math.max(0, parseInt(e.target.value || '0', 10)),
                          },
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono-tech"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
