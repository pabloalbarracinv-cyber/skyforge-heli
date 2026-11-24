import type { ControlInputs } from '../physics/FlightModel';

export type InputDeviceType = 'keyboard' | 'gamepad' | 'joystick' | 'touch' | 'mouse';

export interface AxisCalibration {
  pitchAxis: number;
  rollAxis: number;
  yawAxis: number;
  collectiveAxis: number;
  invertPitch: boolean;
  invertRoll: boolean;
  invertYaw: boolean;
  invertCollective: boolean;
  deadzone: number;
}

export const DEFAULT_JOYSTICK_CALIBRATION: AxisCalibration = {
  pitchAxis: 1,
  rollAxis: 0,
  yawAxis: 2,
  collectiveAxis: 3,
  invertPitch: true,
  invertRoll: false,
  invertYaw: false,
  invertCollective: true,
  deadzone: 0.08,
};

// Aplica zona muerta y curva exponencial suave para precisión alrededor del centro
export function shapeAxis(value: number, deadzone = 0.08, expo = 0.35): number {
  const clamped = Math.max(-1, Math.min(1, value));
  const abs = Math.abs(clamped);
  if (abs <= deadzone) return 0;
  const normalized = (abs - deadzone) / (1 - deadzone);
  const curved = (1 - expo) * normalized + expo * normalized * normalized * normalized;
  return Math.sign(clamped) * curved;
}

export interface InputSnapshot {
  controls: ControlInputs;
  activeDevice: InputDeviceType;
  gamepadName: string | null;
  mouseFlightActive: boolean;
  cameraCycleRequested: boolean;
  resetRequested: boolean;
  modeToggleRequested: boolean;
  pauseRequested: boolean;
}
