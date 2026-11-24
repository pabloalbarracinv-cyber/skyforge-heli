import * as THREE from 'three';

// Efecto de remolino (downwash) de polvo o spray de agua cuando el helicóptero vuela bajo (< 16 m AGL)
export class RotorDownwashFx {
  readonly group = new THREE.Group();
  private ring1: THREE.Mesh;
  private ring2: THREE.Mesh;

  constructor() {
    const geo = new THREE.RingGeometry(2.2, 6.2, 28);
    geo.rotateX(-Math.PI / 2);

    const mat1 = new THREE.MeshBasicMaterial({
      color: 0xe2d5b5,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mat2 = mat1.clone();

    this.ring1 = new THREE.Mesh(geo, mat1);
    this.ring2 = new THREE.Mesh(geo, mat2);
    this.group.add(this.ring1, this.ring2);
  }

  update(
    heliPos: THREE.Vector3,
    surfaceY: number,
    aglMeters: number,
    overWater: boolean,
    thrustN: number,
    elapsedSec: number
  ): void {
    if (aglMeters > 16 || thrustN < 3000) {
      this.group.visible = false;
      return;
    }

    this.group.visible = true;
    this.group.position.set(heliPos.x, surfaceY + 0.18, heliPos.z);

    const intensity = Math.max(0, 1 - aglMeters / 16) * Math.min(1, thrustN / 18000);
    const tint = overWater ? 0xe0f2fe : 0xd6c7a9;

    const phase1 = (elapsedSec * 1.35) % 1;
    const phase2 = (elapsedSec * 1.35 + 0.5) % 1;

    this.applyRing(this.ring1, phase1, intensity, tint);
    this.applyRing(this.ring2, phase2, intensity, tint);
  }

  private applyRing(mesh: THREE.Mesh, phase: number, intensity: number, hex: number): void {
    const scale = 0.55 + phase * 1.75;
    mesh.scale.set(scale, 1, scale);
    const mat = mesh.material as THREE.MeshBasicMaterial;
    mat.color.setHex(hex);
    mat.opacity = Math.sin(phase * Math.PI) * 0.28 * intensity;
  }

  dispose(): void {
    this.ring1.geometry.dispose();
    (this.ring1.material as THREE.Material).dispose();
    (this.ring2.material as THREE.Material).dispose();
  }
}
