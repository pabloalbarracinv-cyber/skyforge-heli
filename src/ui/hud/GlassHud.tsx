import React from 'react';
import {
  Camera,
  Compass,
  Gamepad2,
  Gauge,
  HelpCircle,
  MousePointer,
  Pause,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Volume2,
  VolumeX,
  Wind,
} from 'lucide-react';
import type { SimHudState } from '../../engine/SimStore';
import { formatAltitude, formatSpeed, formatVsi } from '../formatters';

interface GlassHudProps {
  hud: SimHudState;
  muted: boolean;
  onCycleCamera: () => void;
  onToggleMode: () => void;
  onToggleMouse: () => void;
  onRestart: () => void;
  onPause: () => void;
  onToggleMute: () => void;
  onOpenHelp: () => void;
}

const DEVICE_LABELS: Record<SimHudState['activeDevice'], string> = {
  keyboard: 'Teclado',
  gamepad: 'Gamepad',
  joystick: 'HOTAS / Joystick',
  touch: 'Táctil',
  mouse: 'Ratón + Teclado',
};

export const GlassHud: React.FC<GlassHudProps> = ({
  hud,
  muted,
  onCycleCamera,
  onToggleMode,
  onToggleMouse,
  onRestart,
  onPause,
  onToggleMute,
  onOpenHelp,
}) => {
  const agl = formatAltitude(hud.aglMeters, hud.units);
  const msl = formatAltitude(hud.altitudeMslMeters, hud.units);
  const spd = formatSpeed(hud.airSpeedMs, hud.units);
  const vsi = formatVsi(hud.verticalSpeedMs, hud.units);

  const relBearing =
    hud.mission.targetBearingDeg !== null
      ? ((hud.mission.targetBearingDeg - hud.headingDeg + 540) % 360) - 180
      : null;

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-3 sm:p-5 font-sans-ui text-[#F6F1E6] select-none">
      {/* Barra superior: Brújula + Controles rápidos */}
      <div className="flex items-start justify-between gap-2">
        {/* Píldoras estado sistema */}
        <div className="pointer-events-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onPause}
            data-ui-interactive="true"
            className="hud-glass flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium tracking-wide hover:bg-slate-800/80 transition cursor-pointer"
            title="Menú / Pausa (Esc)"
          >
            <Pause className="h-3.5 w-3.5 text-amber-400" />
            <span>Menú</span>
          </button>

          <button
            type="button"
            onClick={onToggleMode}
            data-ui-interactive="true"
            className={`hud-glass flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
              hud.flightMode === 'assisted'
                ? 'border-emerald-400/40 text-emerald-200'
                : 'border-amber-400/50 text-amber-200'
            }`}
            title="Alternar modo Asistido / Realista (Tecla M)"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>{hud.flightMode === 'assisted' ? 'Modo Asistido' : 'Modo Realista'}</span>
          </button>

          <button
            type="button"
            onClick={onCycleCamera}
            data-ui-interactive="true"
            className="hud-glass flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium hover:bg-slate-800/80 transition cursor-pointer"
            title="Cambiar Cámara (Tecla C)"
          >
            <Camera className="h-3.5 w-3.5 text-sky-300" />
            <span className="capitalize">
              {hud.cameraMode === 'chase'
                ? 'Exterior'
                : hud.cameraMode === 'cockpit'
                  ? 'Cabina'
                  : 'Órbita'}
            </span>
          </button>

          <div className="hud-glass hidden md:flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-slate-200">
            {hud.activeDevice === 'touch' ? (
              <Smartphone className="h-3.5 w-3.5 text-sky-300" />
            ) : (
              <Gamepad2 className="h-3.5 w-3.5 text-sky-300" />
            )}
            <span>{DEVICE_LABELS[hud.activeDevice]}</span>
          </div>
        </div>

        {/* Cinta de Rumbo Central */}
        <div className="hud-glass hidden sm:flex flex-col items-center rounded-2xl px-5 py-2 min-w-[190px]">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-slate-300">
            <Compass className="h-3.5 w-3.5 text-amber-400" />
            <span>Rumbo</span>
            <span className="font-mono-tech text-sm font-semibold text-white">
              {Math.round(hud.headingDeg).toString().padStart(3, '0')}°
            </span>
          </div>
          {relBearing !== null && hud.mission.targetDistanceMeters !== null && (
            <div className="mt-1 flex items-center gap-2 text-[11px] text-sky-300 font-mono-tech">
              <span>
                OBJ {relBearing > 5 ? '→' : relBearing < -5 ? '←' : '▲'}{' '}
                {hud.mission.targetDistanceMeters >= 1000
                  ? `${(hud.mission.targetDistanceMeters / 1000).toFixed(2)} km`
                  : `${Math.round(hud.mission.targetDistanceMeters)} m`}
              </span>
            </div>
          )}
        </div>

        {/* Acciones derecha */}
        <div className="pointer-events-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={onToggleMouse}
            data-ui-interactive="true"
            className={`hud-glass hidden sm:flex items-center gap-1 rounded-full px-3 py-1.5 text-xs transition cursor-pointer ${
              hud.mouseFlightActive ? 'border-sky-400/60 text-sky-200' : 'text-slate-300'
            }`}
            title="Cíclico con Ratón (Tecla V)"
          >
            <MousePointer className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">Ratón</span>
          </button>

          <button
            type="button"
            onClick={onRestart}
            data-ui-interactive="true"
            className="hud-glass rounded-full p-2 hover:bg-slate-800/80 transition cursor-pointer"
            title="Reiniciar Vuelo (Tecla R)"
          >
            <RotateCcw className="h-4 w-4 text-slate-200" />
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            data-ui-interactive="true"
            className="hud-glass rounded-full p-2 hover:bg-slate-800/80 transition cursor-pointer"
            title="Audio On/Off"
          >
            {muted ? (
              <VolumeX className="h-4 w-4 text-rose-300" />
            ) : (
              <Volume2 className="h-4 w-4 text-emerald-300" />
            )}
          </button>

          <button
            type="button"
            onClick={onOpenHelp}
            data-ui-interactive="true"
            className="hud-glass rounded-full p-2 hover:bg-slate-800/80 transition cursor-pointer"
            title="Guía de Controles"
          >
            <HelpCircle className="h-4 w-4 text-amber-300" />
          </button>
        </div>
      </div>

      {/* Alerta central de tasa de descenso excesiva */}
      {hud.sinkRateWarning && (
        <div className="mx-auto rounded-full bg-rose-600/90 px-5 py-1.5 text-xs font-bold uppercase tracking-widest text-white shadow-lg animate-pulse">
          ¡Tasa de descenso alta — Sube Colectivo!
        </div>
      )}

      {/* Paneles inferiores de telemetría (solo visibles en cámaras exteriores; en cabina se muestra CockpitPanel) */}
      {hud.cameraMode !== 'cockpit' && (
        <div className="flex items-end justify-between gap-3">
          {/* Izquierda: Colectivo, RPM y Par */}
          <div className="hud-glass flex items-end gap-3.5 rounded-2xl p-3.5">
            {/* Barra vertical de Colectivo */}
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-mono-tech uppercase tracking-wider text-slate-300">
                COL
              </span>
              <div className="relative mt-1 h-24 w-3.5 overflow-hidden rounded-full bg-slate-800/90 border border-slate-600/50">
                {hud.flightMode === 'assisted' && (
                  <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-emerald-400/70 z-10" />
                )}
                <div
                  className="absolute bottom-0 left-0 right-0 rounded-full bg-gradient-to-t from-sky-500 to-amber-400 transition-all duration-75"
                  style={{ height: `${Math.round(hud.collective * 100)}%` }}
                />
              </div>
              <span className="mt-1 font-mono-tech text-xs font-semibold">
                {Math.round(hud.collective * 100)}%
              </span>
            </div>

            {/* Indicadores motor y sustentación */}
            <div className="flex flex-col justify-between gap-1.5 min-w-[125px]">
              <div>
                <div className="flex items-center justify-between text-[11px] text-slate-300">
                  <span className="flex items-center gap-1">
                    <Gauge className="h-3 w-3 text-sky-300" /> RPM Rotor
                  </span>
                  <span className="font-mono-tech font-semibold text-white">
                    {Math.round(hud.rotorRpmPercent)}%
                  </span>
                </div>
                <div className="mt-0.5 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 transition-all"
                    style={{ width: `${Math.min(100, hud.rotorRpmPercent)}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-[11px] text-slate-300">
                  <span>Par (TRQ)</span>
                  <span className="font-mono-tech font-semibold text-amber-300">
                    {Math.round(hud.torquePercent)}%
                  </span>
                </div>
                <div className="mt-0.5 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      hud.torquePercent > 95 ? 'bg-rose-500' : 'bg-amber-400'
                    }`}
                    style={{ width: `${Math.min(100, hud.torquePercent)}%` }}
                  />
                </div>
              </div>

              <div className="mt-1 flex items-center gap-1.5">
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-mono-tech font-semibold ${
                    hud.igeActive
                      ? 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/40'
                      : 'bg-slate-800/70 text-slate-500'
                  }`}
                  title="Efecto Suelo (In Ground Effect)"
                >
                  IGE
                </span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-mono-tech font-semibold ${
                    hud.etlActive
                      ? 'bg-sky-500/30 text-sky-200 border border-sky-400/40'
                      : 'bg-slate-800/70 text-slate-500'
                  }`}
                  title="Sustentación Traslacional Efectiva"
                >
                  ETL
                </span>
                <span className="ml-auto text-[10px] font-mono-tech text-slate-400">
                  {hud.fps} FPS
                </span>
              </div>
            </div>
          </div>

          {/* Centro: Mini indicador de Cíclico + Horizonte */}
          <div className="hud-glass hidden md:flex items-center gap-4 rounded-2xl px-4 py-2.5">
            <div className="relative h-14 w-14 rounded-full border border-slate-500/50 bg-slate-900/70 flex items-center justify-center">
              <div className="absolute h-px w-full bg-slate-700" />
              <div className="absolute w-px h-full bg-slate-700" />
              <div
                className="h-2.5 w-2.5 rounded-full bg-amber-400 shadow"
                style={{
                  transform: `translate(${hud.cyclicRoll * 20}px, ${-hud.cyclicPitch * 20}px)`,
                }}
              />
            </div>
            <div className="text-xs font-mono-tech space-y-0.5">
              <div className="text-slate-300">
                PITCH <span className="text-white">{hud.pitchDeg.toFixed(1)}°</span>
              </div>
              <div className="text-slate-300">
                ROLL <span className="text-white">{hud.rollDeg.toFixed(1)}°</span>
              </div>
              <div className="text-slate-300">
                YAW{' '}
                <span className="text-sky-300">
                  {hud.yawPedal >= 0 ? '+' : ''}
                  {Math.round(hud.yawPedal * 100)}%
                </span>
              </div>
            </div>
          </div>

          {/* Derecha: Velocidad, Altitud AGL/MSL y Variómetro */}
          <div className="hud-glass grid grid-cols-3 gap-3 rounded-2xl px-4 py-3 text-right">
            <div>
              <div className="flex items-center justify-end gap-1 text-[10px] uppercase tracking-wider text-slate-300">
                <Wind className="h-3 w-3 text-sky-300" /> VEL
              </div>
              <div className="font-mono-tech text-xl font-bold leading-tight text-white">
                {spd.value}
              </div>
              <div className="font-mono-tech text-[10px] text-slate-400">{spd.unit}</div>
            </div>

            <div className="border-l border-slate-600/40 pl-3">
              <div className="text-[10px] uppercase tracking-wider text-amber-300">ALT Suelo</div>
              <div className="font-mono-tech text-xl font-bold leading-tight text-white">
                {agl.value}
              </div>
              <div className="font-mono-tech text-[10px] text-slate-400">
                {agl.unit} · MSL {msl.value}
              </div>
            </div>

            <div className="border-l border-slate-600/40 pl-3">
              <div className="text-[10px] uppercase tracking-wider text-slate-300">VARIO</div>
              <div
                className={`font-mono-tech text-lg font-bold leading-tight ${
                  hud.verticalSpeedMs < -3.2 ? 'text-rose-400' : 'text-emerald-300'
                }`}
              >
                {vsi.value}
              </div>
              <div className="font-mono-tech text-[10px] text-slate-400">{vsi.unit}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
