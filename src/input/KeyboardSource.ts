// Teclado:
// - Colectivo: W / S (en modo Asistido se centra suavemente a 0.5 al soltar, salvo posado abajo; en Realista actúa como palanca incremental)
// - Cíclico: Flechas Arriba/Abajo (pitch) y Flechas Izquierda/Derecha (roll) — también soporta I/K/J/L
// - Pedales (Yaw): A / D o Q / E
// - Cámara: C | Modo vuelo: M | Reiniciar: R | Pausa: Escape | Motor: E (mantener/toggle con X)
export class KeyboardSource {
  private pressed = new Set<string>();
  private collective = 0.2;
  private pitch = 0;
  private roll = 0;
  private yaw = 0;
  private engineOn = true;

  private cameraQueue = false;
  private resetQueue = false;
  private modeQueue = false;
  private pauseQueue = false;
  private mouseToggleQueue = false;
  private lastActivityMs = 0;

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    const code = e.code;
    if (
      code.startsWith('Arrow') ||
      code === 'Space'
    ) {
      e.preventDefault();
    }
    if (!this.pressed.has(code)) {
      if (code === 'KeyC') this.cameraQueue = true;
      if (code === 'KeyR') this.resetQueue = true;
      if (code === 'KeyM') this.modeQueue = true;
      if (code === 'Escape' || code === 'KeyP') this.pauseQueue = true;
      if (code === 'KeyX') this.engineOn = !this.engineOn;
      if (code === 'KeyV') this.mouseToggleQueue = true;
    }
    this.pressed.add(code);
    this.lastActivityMs = performance.now();
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.pressed.delete(e.code);
  };

  private onBlur = () => {
    this.pressed.clear();
  };

  attach(): void {
    if (typeof window === 'undefined') return;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
  }

  detach(): void {
    if (typeof window === 'undefined') return;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
  }

  resetControls(assistedMode: boolean, initialCollective?: number): void {
    this.collective = initialCollective ?? (assistedMode ? 0.3 : 0.05);
    this.pitch = 0;
    this.roll = 0;
    this.yaw = 0;
    this.engineOn = true;
  }

  setCollective(val: number): void {
    this.collective = Math.max(0, Math.min(1, val));
  }

  update(dt: number, assistedMode: boolean, onGround: boolean): {
    collective: number;
    cyclicPitch: number;
    cyclicRoll: number;
    yawPedal: number;
    engineOn: boolean;
    hasActiveInput: boolean;
  } {
    const upPressed = this.pressed.has('KeyW') || this.pressed.has('Space');
    const downPressed = this.pressed.has('KeyS') || this.pressed.has('ShiftLeft');

    if (assistedMode) {
      if (upPressed) {
        this.collective = Math.min(1, this.collective + dt * 1.35);
      } else if (downPressed) {
        this.collective = Math.max(0, this.collective - dt * 1.35);
      } else if (!onGround) {
        // Retorno suave al centro (0.5 = mantener altitud) cuando está volando en modo asistido
        const diff = 0.5 - this.collective;
        this.collective += Math.sign(diff) * Math.min(Math.abs(diff), dt * 1.8);
      }
    } else {
      // En modo Realista el colectivo se queda donde el piloto lo deja (como palanca real)
      if (upPressed) this.collective = Math.min(1, this.collective + dt * 0.52);
      if (downPressed) this.collective = Math.max(0, this.collective - dt * 0.52);
    }

    const targetPitch =
      (this.pressed.has('ArrowUp') || this.pressed.has('KeyI') ? 1 : 0) -
      (this.pressed.has('ArrowDown') || this.pressed.has('KeyK') ? 1 : 0);
    const targetRoll =
      (this.pressed.has('ArrowRight') || this.pressed.has('KeyL') ? 1 : 0) -
      (this.pressed.has('ArrowLeft') || this.pressed.has('KeyJ') ? 1 : 0);
    const targetYaw =
      (this.pressed.has('KeyD') || this.pressed.has('KeyE') ? 1 : 0) -
      (this.pressed.has('KeyA') || this.pressed.has('KeyQ') ? 1 : 0);

    const rate = 5.2;
    this.pitch += (targetPitch - this.pitch) * Math.min(1, dt * rate);
    this.roll += (targetRoll - this.roll) * Math.min(1, dt * rate);
    this.yaw += (targetYaw - this.yaw) * Math.min(1, dt * rate);

    if (Math.abs(this.pitch) < 0.005) this.pitch = 0;
    if (Math.abs(this.roll) < 0.005) this.roll = 0;
    if (Math.abs(this.yaw) < 0.005) this.yaw = 0;

    const hasActiveInput =
      upPressed ||
      downPressed ||
      targetPitch !== 0 ||
      targetRoll !== 0 ||
      targetYaw !== 0;

    return {
      collective: this.collective,
      cyclicPitch: this.pitch,
      cyclicRoll: this.roll,
      yawPedal: this.yaw,
      engineOn: this.engineOn,
      hasActiveInput,
    };
  }

  consumeActions(): {
    camera: boolean;
    reset: boolean;
    mode: boolean;
    pause: boolean;
    mouseToggle: boolean;
  } {
    const out = {
      camera: this.cameraQueue,
      reset: this.resetQueue,
      mode: this.modeQueue,
      pause: this.pauseQueue,
      mouseToggle: this.mouseToggleQueue,
    };
    this.cameraQueue = false;
    this.resetQueue = false;
    this.modeQueue = false;
    this.pauseQueue = false;
    this.mouseToggleQueue = false;
    return out;
  }

  getLastActivityMs(): number {
    return this.lastActivityMs;
  }
}
