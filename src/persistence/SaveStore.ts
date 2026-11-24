import type { AxisCalibration } from '../input/types';
import { DEFAULT_JOYSTICK_CALIBRATION } from '../input/types';
import type { QualityPreset } from '../engine/Quality';
import { detectRecommendedQuality } from '../engine/Quality';
import type { FlightMode } from '../physics/FlightAssist';

export type UnitSystem = 'aviation' | 'metric'; // pies/kt/fpm vs m/kmh/ms
export type MissionId = 'free_flight' | 'precision_landing' | 'ring_circuit' | 'alpine_rescue';

export interface MissionRecord {
  missionId: MissionId;
  bestTimeSec: number;
  bestScore: number;
  stars: 1 | 2 | 3;
  completedAtIso: string;
}

export interface UserSettings {
  flightMode: FlightMode;
  units: UnitSystem;
  quality: QualityPreset;
  masterVolume: number;
  muted: boolean;
  joystickCalibration: AxisCalibration;
}

// Interfaz desacoplada lista para enchufar SupabaseStore (tablas de clasificación / perfiles) en v2
export interface SaveStore {
  getSettings(): UserSettings;
  saveSettings(settings: UserSettings): void;
  getRecords(): Record<string, MissionRecord>;
  saveMissionResult(record: MissionRecord): MissionRecord;
}

const SETTINGS_KEY = 'skyforge_heli_settings_v1';
const RECORDS_KEY = 'skyforge_heli_records_v1';

export class LocalSaveStore implements SaveStore {
  getSettings(): UserSettings {
    const defaults: UserSettings = {
      flightMode: 'assisted',
      units: 'aviation',
      quality: detectRecommendedQuality(),
      masterVolume: 0.55,
      muted: false,
      joystickCalibration: { ...DEFAULT_JOYSTICK_CALIBRATION },
    };

    if (typeof window === 'undefined') return defaults;
    try {
      const raw = window.localStorage.getItem(SETTINGS_KEY);
      if (!raw) return defaults;
      const parsed = JSON.parse(raw) as Partial<UserSettings>;
      return {
        ...defaults,
        ...parsed,
        joystickCalibration: {
          ...defaults.joystickCalibration,
          ...(parsed.joystickCalibration ?? {}),
        },
      };
    } catch {
      return defaults;
    }
  }

  saveSettings(settings: UserSettings): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // Ignorar cuota excedida en modo privado
    }
  }

  getRecords(): Record<string, MissionRecord> {
    if (typeof window === 'undefined') return {};
    try {
      const raw = window.localStorage.getItem(RECORDS_KEY);
      if (!raw) return {};
      return JSON.parse(raw) as Record<string, MissionRecord>;
    } catch {
      return {};
    }
  }

  saveMissionResult(record: MissionRecord): MissionRecord {
    const all = this.getRecords();
    const existing = all[record.missionId];
    const merged: MissionRecord = existing
      ? {
          missionId: record.missionId,
          bestTimeSec: Math.min(existing.bestTimeSec, record.bestTimeSec),
          bestScore: Math.max(existing.bestScore, record.bestScore),
          stars: Math.max(existing.stars, record.stars) as 1 | 2 | 3,
          completedAtIso: record.completedAtIso,
        }
      : record;

    all[record.missionId] = merged;
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(RECORDS_KEY, JSON.stringify(all));
      } catch {
        // Ignorar errores de almacenamiento
      }
    }
    return merged;
  }
}

export const saveStore: SaveStore = new LocalSaveStore();
