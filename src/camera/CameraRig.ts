import * as THREE from 'three';

export type CameraMode = 'chase' | 'cockpit' | 'orbit';

export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  private mode: CameraMode = 'chase';

  private smoothedPos = new THREE.Vector3(0, 24, 18);
  private smoothedLook = new THREE.Vector3(0, 18, 0);

  private orbitAzimuth = 0.55;
  private orbitElevation = 0.32;
  private orbitDistance = 17.5;
  private draggingOrbit = false;
  private prevPointer = { x: 0, y: 0 };

  private onPointerDown = (e: PointerEvent) => {
    if (this.mode !== 'orbit') return;
    if ((e.target as HTMLElement)?.closest('button, input, [data-ui-interactive]')) return;
    this.draggingOrbit = true;
    this.prevPointer = { x: e.clientX, y: e.clientY };
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.draggingOrbit || this.mode !== 'orbit') return;
    const dx = e.clientX - this.prevPointer.x;
    const dy = e.clientY - this.prevPointer.y;
    this.prevPointer = { x: e.clientX, y: e.clientY };
    this.orbitAzimuth -= dx * 0.0065;
    this.orbitElevation = Math.max(-0.15, Math.min(1.25, this.orbitElevation + dy * 0.0055));
  };

  private onPointerUp = () => {
    this.draggingOrbit = false;
  };

  private onWheel = (e: WheelEvent) => {
    if (this.mode !== 'orbit') return;
    this.orbitDistance = Math.max(7, Math.min(48, this.orbitDistance + Math.sign(e.deltaY) * 1.6));
  };

  constructor(aspect = 16 / 9) {
    this.camera = new THREE.PerspectiveCamera(62, aspect, 0.22, 3600);
  }

  attach(domElement: HTMLElement): void {
    domElement.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    domElement.addEventListener('wheel', this.onWheel, { passive: true });
  }

  detach(domElement: HTMLElement): void {
    domElement.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    domElement.removeEventListener('wheel', this.onWheel);
  }

  getMode(): CameraMode {
    return this.mode;
  }

  setMode(mode: CameraMode): void {
    this.mode = mode;
    this.camera.fov = mode === 'cockpit' ? 72 : 62;
    this.camera.updateProjectionMatrix();
  }

  cycleMode(): CameraMode {
    const order: CameraMode[] = ['chase', 'cockpit', 'orbit'];
    const next = order[(order.indexOf(this.mode) + 1) % order.length];
    this.setMode(next);
    return next;
  }

  resize(width: number, height: number): void {
    this.camera.aspect = Math.max(0.5, width / Math.max(1, height));
    this.camera.updateProjectionMatrix();
  }

  snapToHeli(heliPos: THREE.Vector3, heliQuat: THREE.Quaternion): void {
    const yawOnly = this.extractYawQuat(heliQuat);
    const offset = new THREE.Vector3(0, 5.2, 15.5).applyQuaternion(yawOnly);
    this.smoothedPos.copy(heliPos).add(offset);
    this.smoothedLook.copy(heliPos).add(new THREE.Vector3(0, 1.2, -5).applyQuaternion(yawOnly));
    this.camera.position.copy(this.smoothedPos);
    this.camera.lookAt(this.smoothedLook);
  }

  private extractYawQuat(q: THREE.Quaternion): THREE.Quaternion {
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
    const heading = Math.atan2(fwd.x, -fwd.z);
    return new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -heading);
  }

  update(
    heliPos: THREE.Vector3,
    heliQuat: THREE.Quaternion,
    cockpitAnchorWorld: THREE.Vector3,
    getSurfaceHeight: (x: number, z: number) => number,
    dt: number
  ): void {
    if (this.mode === 'cockpit') {
      this.camera.position.copy(cockpitAnchorWorld);
      const lookDir = new THREE.Vector3(0, -0.06, -12).applyQuaternion(heliQuat);
      const upVec = new THREE.Vector3(0, 1, 0).applyQuaternion(heliQuat);
      this.camera.up.copy(upVec);
      this.camera.lookAt(cockpitAnchorWorld.clone().add(lookDir));
      return;
    }

    this.camera.up.set(0, 1, 0);

    if (this.mode === 'orbit') {
      const horiz = Math.cos(this.orbitElevation) * this.orbitDistance;
      const desired = new THREE.Vector3(
        heliPos.x + Math.sin(this.orbitAzimuth) * horiz,
        heliPos.y + Math.sin(this.orbitElevation) * this.orbitDistance + 1.5,
        heliPos.z + Math.cos(this.orbitAzimuth) * horiz
      );
      const minGround = getSurfaceHeight(desired.x, desired.z) + 1.6;
      if (desired.y < minGround) desired.y = minGround;

      this.camera.position.lerp(desired, Math.min(1, dt * 10));
      this.camera.lookAt(heliPos.x, heliPos.y + 0.6, heliPos.z);
      return;
    }

    // Cámara de persecución elástica alineada al rumbo del helicóptero
    const yawQuat = this.extractYawQuat(heliQuat);
    const desiredPos = new THREE.Vector3(0, 5.0, 15.2).applyQuaternion(yawQuat).add(heliPos);
    const minSurface = getSurfaceHeight(desiredPos.x, desiredPos.z) + 2.0;
    if (desiredPos.y < minSurface) desiredPos.y = minSurface;

    const desiredLook = new THREE.Vector3(0, 1.1, -6.5).applyQuaternion(yawQuat).add(heliPos);

    const alphaPos = 1 - Math.exp(-6.5 * dt);
    const alphaLook = 1 - Math.exp(-10.0 * dt);
    this.smoothedPos.lerp(desiredPos, alphaPos);
    this.smoothedLook.lerp(desiredLook, alphaLook);

    this.camera.position.copy(this.smoothedPos);
    this.camera.lookAt(this.smoothedLook);
  }
}
