import type { CameraMode } from '../camera/CameraRig';
import type { InputDeviceType } from '../input/types';
import type { MissionLiveStatus } from '../missions/MissionSystem';
import type { FlightMode } from '../physics/FlightAssist';
import type { UnitSystem } from '../persistence/SaveStore';

export interface SimHudState {
  running: boolean;
  paused: boolean;
  fps: number;

  // Vuelo y actitud
  altitudeMslMeters: number;
  aglMeters: number;
  airSpeedMs: number;
  forwardSpeedMs: number;
  verticalSpeedMs: number;
  pitchDeg: number;
  rollDeg: number;
  headingDeg: number;
  slipLateralMs: number;

  // Motor y mandos
  rotorRpmPercent: number;
  torquePercent: number;
  igeActive: boolean;
  etlActive: boolean;
  collective: number;
  cyclicPitch: number;
  cyclicRoll: number;
  yawPedal: number;
  engineOn: boolean;
  onGround: boolean;
  sinkRateWarning: boolean;

  // Configuración activa
  flightMode: FlightMode;
  cameraMode: CameraMode;
  activeDevice: InputDeviceType;
  gamepadName: string | null;
  mouseFlightActive: boolean;
  units: UnitSystem;

  // Misión
  mission: MissionLiveStatus;
}

const INITIAL_HUD_STATE: SimHudState = {
  running: false,
  paused: false,
  fps: 60,
  altitudeMslMeters: 19.5,
  aglMeters: 0,
  airSpeedMs: 0,
  forwardSpeedMs: 0,
  verticalSpeedMs: 0,
  pitchDeg: 0,
  rollDeg: 0,
  headingDeg: 35,
  slipLateralMs: 0,
  rotorRpmPercent: 100,
  torquePercent: 22,
  igeActive: true,
  etlActive: false,
  collective: 0.25,
  cyclicPitch: 0,
  cyclicRoll: 0,
  yawPedal: 0,
  engineOn: true,
  onGround: true,
  sinkRateWarning: false,
  flightMode: 'assisted',
  cameraMode: 'chase',
  activeDevice: 'keyboard',
  gamepadName: null,
  mouseFlightActive: false,
  units: 'aviation',
  mission: {
    missionId: 'free_flight',
    elapsedSec: 0,
    objectiveText: 'Listo para despegar',
    progressCurrent: 0,
    progressTotal: 0,
    rescueHoldProgress: 0,
    targetPosition: null,
    targetDistanceMeters: null,
    targetBearingDeg: null,
    completed: false,
    failed: false,
    failReason: null,
    score: 0,
    stars: 3,
  },
};

export class SimStore {
  private state: SimHudState = INITIAL_HUD_STATE;
  private listeners = new Set<() => void>();
  private lastEmitMs = 0;

  getSnapshot = (): SimHudState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  publish(next: SimHudState, forceImmediate = false): void {
    this.state = next;
    const now = performance.now();
    // Limitar notificaciones React a ~24 Hz salvo eventos discretos (pausa, misión completada, cambio cámara)
    if (forceImmediate || now - this.lastEmitMs >= 40) {
      this.lastEmitMs = now;
      this.listeners.forEach((fn) => fn());
    }
  }
}

export const simStore = new SimStore();
