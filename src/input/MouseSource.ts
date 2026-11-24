// Control de cíclico opcional con ratón (activable con tecla V o botón en HUD)
export class MouseFlightSource {
  private active = false;
  private normX = 0; // -1..1 (roll)
  private normY = 0; // -1..1 (pitch)
  private movedRecently = false;

  private onMouseMove = (e: MouseEvent) => {
    if (!this.active) return;
    if (document.pointerLockElement) {
      this.normX = Math.max(-1, Math.min(1, this.normX + e.movementX * 0.0028));
      this.normY = Math.max(-1, Math.min(1, this.normY - e.movementY * 0.0028));
    } else {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      this.normX = Math.max(-1, Math.min(1, (e.clientX - cx) / (window.innerWidth * 0.32)));
      this.normY = Math.max(-1, Math.min(1, -(e.clientY - cy) / (window.innerHeight * 0.32)));
    }
    this.movedRecently = true;
  };

  private onWheel = (e: WheelEvent) => {
    if (!this.active) return;
    this.wheelDelta -= Math.sign(e.deltaY) * 0.04;
  };

  private wheelDelta = 0;

  attach(): void {
    if (typeof window === 'undefined') return;
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('wheel', this.onWheel, { passive: true });
  }

  detach(): void {
    if (typeof window === 'undefined') return;
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('wheel', this.onWheel);
  }

  setActive(enabled: boolean): void {
    this.active = enabled;
    this.normX = 0;
    this.normY = 0;
  }

  toggle(): boolean {
    this.setActive(!this.active);
    return this.active;
  }

  isActive(): boolean {
    return this.active;
  }

  center(): void {
    this.normX = 0;
    this.normY = 0;
  }

  read(): { pitch: number; roll: number; wheelDelta: number; moved: boolean } {
    const moved = this.movedRecently;
    this.movedRecently = false;
    const wd = this.wheelDelta;
    this.wheelDelta = 0;
    return {
      pitch: Math.abs(this.normY) < 0.04 ? 0 : this.normY,
      roll: Math.abs(this.normX) < 0.04 ? 0 : this.normX,
      wheelDelta: wd,
      moved,
    };
  }
}
