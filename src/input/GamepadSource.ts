import type { AxisCalibration } from './types';
import { shapeAxis } from './types';

export interface GamepadReadResult {
  connected: boolean;
  isHotas: boolean;
  name: string | null;
  collective: number;
  cyclicPitch: number;
  cyclicRoll: number;
  yawPedal: number;
  hasMovement: boolean;
  cameraPressed: boolean;
  resetPressed: boolean;
  modePressed: boolean;
  rawAxes: number[];
}

// Soporta tanto Gamepads estándar (Xbox / DualSense, mapping === 'standard') como Joysticks/HOTAS de vuelo
export class GamepadAndJoystickSource {
  private realisticCollective = 0.2;
  private prevCamBtn = false;
  private prevResetBtn = false;
  private prevModeBtn = false;

  poll(
    dt: number,
    assistedMode: boolean,
    calibration: AxisCalibration
  ): GamepadReadResult {
    const empty: GamepadReadResult = {
      connected: false,
      isHotas: false,
      name: null,
      collective: 0.3,
      cyclicPitch: 0,
      cyclicRoll: 0,
      yawPedal: 0,
      hasMovement: false,
      cameraPressed: false,
      resetPressed: false,
      modePressed: false,
      rawAxes: [],
    };

    if (typeof navigator === 'undefined' || !navigator.getGamepads) {
      return empty;
    }

    const pads = navigator.getGamepads();
    let activePad: Gamepad | null = null;
    for (let i = 0; i < pads.length; i++) {
      const p = pads[i];
      if (p && p.connected) {
        activePad = p;
        break;
      }
    }

    if (!activePad) return empty;

    const idLower = activePad.id.toLowerCase();
    const isStandardGamepad =
      activePad.mapping === 'standard' &&
      !idLower.includes('hotas') &&
      !idLower.includes('thrustmaster') &&
      !idLower.includes('logitech extreme') &&
      !idLower.includes('saitek') &&
      !idLower.includes('vkb') &&
      !idLower.includes('flight');

    if (isStandardGamepad) {
      // Mapeo Xbox / PlayStation:
      // Stick Derecho (ejes 2, 3): Cíclico Roll / Pitch
      // Stick Izquierdo X (eje 0): Pedales (Yaw)
      // Triggers RT (btn 7) / LT (btn 6) o Stick Izquierdo Y (eje 1): Colectivo
      const lx = shapeAxis(activePad.axes[0] ?? 0, 0.1);
      const ly = shapeAxis(-(activePad.axes[1] ?? 0), 0.12);
      const rx = shapeAxis(activePad.axes[2] ?? 0, 0.1);
      const ry = shapeAxis(-(activePad.axes[3] ?? 0), 0.1);

      const lt = activePad.buttons[6]?.value ?? 0;
      const rt = activePad.buttons[7]?.value ?? 0;
      const triggerDelta = rt - lt;
      const collInput = Math.abs(triggerDelta) > Math.abs(ly) ? triggerDelta : ly;

      let collective: number;
      if (assistedMode) {
        collective = 0.5 + collInput * 0.5;
      } else {
        this.realisticCollective = Math.max(
          0,
          Math.min(1, this.realisticCollective + collInput * dt * 0.6)
        );
        collective = this.realisticCollective;
      }

      const camBtn = Boolean(activePad.buttons[3]?.pressed); // Y / Triángulo
      const resetBtn = Boolean(activePad.buttons[1]?.pressed); // B / Círculo
      const modeBtn = Boolean(activePad.buttons[2]?.pressed); // X / Cuadrado

      const camEdge = camBtn && !this.prevCamBtn;
      const resetEdge = resetBtn && !this.prevResetBtn;
      const modeEdge = modeBtn && !this.prevModeBtn;
      this.prevCamBtn = camBtn;
      this.prevResetBtn = resetBtn;
      this.prevModeBtn = modeBtn;

      const hasMovement =
        Math.abs(lx) > 0.02 ||
        Math.abs(rx) > 0.02 ||
        Math.abs(ry) > 0.02 ||
        Math.abs(collInput) > 0.05 ||
        camEdge ||
        resetEdge ||
        modeEdge;

      return {
        connected: true,
        isHotas: false,
        name: activePad.id,
        collective,
        cyclicPitch: ry,
        cyclicRoll: rx,
        yawPedal: lx,
        hasMovement,
        cameraPressed: camEdge,
        resetPressed: resetEdge,
        modePressed: modeEdge,
        rawAxes: [...activePad.axes],
      };
    }

    // Mapeo Joystick / HOTAS usando calibración configurable
    const rawPitch = activePad.axes[calibration.pitchAxis] ?? 0;
    const rawRoll = activePad.axes[calibration.rollAxis] ?? 0;
    const rawYaw = activePad.axes[calibration.yawAxis] ?? 0;
    const rawThrottle = activePad.axes[calibration.collectiveAxis] ?? 0;

    const pitch = shapeAxis(calibration.invertPitch ? -rawPitch : rawPitch, calibration.deadzone, 0.3);
    const roll = shapeAxis(calibration.invertRoll ? -rawRoll : rawRoll, calibration.deadzone, 0.3);
    const yaw = shapeAxis(calibration.invertYaw ? -rawYaw : rawYaw, calibration.deadzone, 0.25);

    const normThrottle = calibration.invertCollective
      ? (-rawThrottle + 1) * 0.5
      : (rawThrottle + 1) * 0.5;
    const collective = Math.max(0, Math.min(1, normThrottle));

    const camBtn = Boolean(activePad.buttons[1]?.pressed);
    const resetBtn = Boolean(activePad.buttons[2]?.pressed);
    const modeBtn = Boolean(activePad.buttons[3]?.pressed);

    const camEdge = camBtn && !this.prevCamBtn;
    const resetEdge = resetBtn && !this.prevResetBtn;
    const modeEdge = modeBtn && !this.prevModeBtn;
    this.prevCamBtn = camBtn;
    this.prevResetBtn = resetBtn;
    this.prevModeBtn = modeBtn;

    const hasMovement =
      Math.abs(pitch) > 0.02 ||
      Math.abs(roll) > 0.02 ||
      Math.abs(yaw) > 0.02 ||
      camEdge ||
      resetEdge ||
      modeEdge;

    return {
      connected: true,
      isHotas: true,
      name: activePad.id,
      collective,
      cyclicPitch: pitch,
      cyclicRoll: roll,
      yawPedal: yaw,
      hasMovement,
      cameraPressed: camEdge,
      resetPressed: resetEdge,
      modePressed: modeEdge,
      rawAxes: [...activePad.axes],
    };
  }
}
