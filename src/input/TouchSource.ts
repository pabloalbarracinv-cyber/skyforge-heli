// Estado alimentado por los joysticks virtuales táctiles en pantalla (TouchControls.tsx)
export class TouchSource {
  private collective = 0.35;
  private cyclicPitch = 0;
  private cyclicRoll = 0;
  private yawPedal = 0;
  private touching = false;
  private isTouchCapable = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.isTouchCapable = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      window.addEventListener(
        'touchstart',
        () => {
          this.isTouchCapable = true;
        },
        { once: true, passive: true }
      );
    }
  }

  hasTouchScreen(): boolean {
    return this.isTouchCapable;
  }

  setCyclic(roll: number, pitch: number, active: boolean): void {
    this.cyclicRoll = Math.max(-1, Math.min(1, roll));
    this.cyclicPitch = Math.max(-1, Math.min(1, pitch));
    if (active) this.touching = true;
  }

  setLeftStick(yaw: number, collective: number, active: boolean): void {
    this.yawPedal = Math.max(-1, Math.min(1, yaw));
    this.collective = Math.max(0, Math.min(1, collective));
    this.touching = active;
  }

  setCollectiveOnly(collective: number): void {
    this.collective = Math.max(0, Math.min(1, collective));
    this.touching = true;
  }

  releaseTouch(assistedMode: boolean, onGround: boolean): void {
    this.touching = false;
    this.cyclicPitch = 0;
    this.cyclicRoll = 0;
    this.yawPedal = 0;
    if (assistedMode && !onGround) {
      this.collective = 0.5;
    }
  }

  read(): {
    collective: number;
    cyclicPitch: number;
    cyclicRoll: number;
    yawPedal: number;
    active: boolean;
  } {
    return {
      collective: this.collective,
      cyclicPitch: this.cyclicPitch,
      cyclicRoll: this.cyclicRoll,
      yawPedal: this.yawPedal,
      active: this.touching,
    };
  }
}
