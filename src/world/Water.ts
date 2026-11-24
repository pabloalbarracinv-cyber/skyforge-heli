import * as THREE from 'three';
import { LAKE_LEVEL, WORLD_SIZE } from './seed';

export class WaterSystem {
  readonly mesh: THREE.Mesh;
  private material: THREE.MeshStandardMaterial;

  constructor() {
    const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, 32, 32);
    geo.rotateX(-Math.PI / 2);

    this.material = new THREE.MeshStandardMaterial({
      color: 0x1e6b8c,
      roughness: 0.18,
      metalness: 0.35,
      transparent: true,
      opacity: 0.86,
      flatShading: true,
    });

    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.position.y = LAKE_LEVEL;
    this.mesh.receiveShadow = true;
  }

  update(elapsedSec: number): void {
    this.mesh.position.y = LAKE_LEVEL + Math.sin(elapsedSec * 1.3) * 0.08;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
