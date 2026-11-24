import { KeyboardSource } from './KeyboardSource';
import { GamepadAndJoystickSource } from './GamepadSource';
import { MouseFlightSource } from './MouseSource';
import { TouchSource } from './TouchSource';
import type { AxisCalibration, InputDeviceType, InputSnapshot } from './types';
import { DEFAULT_JOYSTICK_CALIBRATION } from './types';

export class InputManager {
  readonly keyboard = new KeyboardSource();
  readonly gamepad = new GamepadAndJoystickSource();
  readonly mouse = new MouseFlightSource();
  readonly touch = new TouchSource();

  private activeDevice: InputDeviceType = 'keyboard';
  private calibration: AxisCalibration = { ...DEFAULT_JOYSTICK_CALIBRATION };

  constructor() {
    if (this.touch.hasTouchScreen() && typeof window !== 'undefined' && window.innerWidth < 960) {
      this.activeDevice = 'touch';
    }
  }

  attach(): void {
    this.keyboard.attach();
    this.mouse.attach();
  }

  detach(): void {
    this.keyboard.detach();
    this.mouse.detach();
  }

  setCalibration(cal: AxisCalibration): void {
    this.calibration = { ...cal };
  }

  getCalibration(): AxisCalibration {
    return { ...this.calibration };
  }

  resetForSpawn(assistedMode: boolean): void {
    this.keyboard.resetControls(assistedMode, assistedMode ? 0.25 : 0.05);
    this.mouse.center();
  }

  update(dt: number, assistedMode: boolean, onGround: boolean): InputSnapshot {
    const kb = this.keyboard.update(dt, assistedMode, onGround);
    const kbActions = this.keyboard.consumeActions();
    if (kbActions.mouseToggle) {
      this.mouse.toggle();
    }

    const gp = this.gamepad.poll(dt, assistedMode, this.calibration);
    const ms = this.mouse.read();
    const tc = this.touch.read();

    // Autodetección dinámica del dispositivo que el usuario está tocando en este instante
    if (tc.active) {
      this.activeDevice = 'touch';
    } else if (gp.connected && gp.hasMovement) {
      this.activeDevice = gp.isHotas ? 'joystick' : 'gamepad';
    } else if (this.mouse.isActive() && ms.moved) {
      this.activeDevice = 'mouse';
    } else if (kb.hasActiveInput) {
      this.activeDevice = this.mouse.isActive() ? 'mouse' : 'keyboard';
    } else if (gp.connected && (this.activeDevice === 'gamepad' || this.activeDevice === 'joystick')) {
      this.activeDevice = gp.isHotas ? 'joystick' : 'gamepad';
    }

    let collective = kb.collective;
    let cyclicPitch = kb.cyclicPitch;
    let cyclicRoll = kb.cyclicRoll;
    let yawPedal = kb.yawPedal;

    if (this.activeDevice === 'touch') {
      collective = tc.collective;
      cyclicPitch = tc.cyclicPitch;
      cyclicRoll = tc.cyclicRoll;
      yawPedal = tc.yawPedal;
    } else if ((this.activeDevice === 'gamepad' || this.activeDevice === 'joystick') && gp.connected) {
      collective = gp.collective;
      cyclicPitch = gp.cyclicPitch;
      cyclicRoll = gp.cyclicRoll;
      yawPedal = gp.yawPedal;
    } else if (this.mouse.isActive()) {
      if (ms.wheelDelta !== 0) {
        this.keyboard.setCollective(kb.collective + ms.wheelDelta);
        collective = Math.max(0, Math.min(1, kb.collective + ms.wheelDelta));
      }
      cyclicPitch = Math.abs(kb.cyclicPitch) > 0.1 ? kb.cyclicPitch : ms.pitch;
      cyclicRoll = Math.abs(kb.cyclicRoll) > 0.1 ? kb.cyclicRoll : ms.roll;
    }

    return {
      controls: {
        collective,
        cyclicPitch,
        cyclicRoll,
        yawPedal,
        engineOn: kb.engineOn,
      },
      activeDevice: this.activeDevice,
      gamepadName: gp.name,
      mouseFlightActive: this.mouse.isActive(),
      cameraCycleRequested: kbActions.camera || gp.cameraPressed,
      resetRequested: kbActions.reset || gp.resetPressed,
      modeToggleRequested: kbActions.mode || gp.modePressed,
      pauseRequested: kbActions.pause,
    };
  }
}
