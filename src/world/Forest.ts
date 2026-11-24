import * as THREE from 'three';
import { mulberry32, WORLD_SEED, LAKE_LEVEL } from './seed';
import type { TerrainSystem } from './Terrain';
import { WORLD_FLAT_ZONES } from './Terrain';

export class ForestSystem {
  readonly group = new THREE.Group();
  private trunks: THREE.InstancedMesh;
  private crowns: THREE.InstancedMesh;

  constructor(terrain: TerrainSystem, maxTrees = 1400) {
    const rand = mulberry32(WORLD_SEED + 99);

    const trunkGeo = new THREE.CylinderGeometry(0.28, 0.45, 2.6, 5);
    trunkGeo.translate(0, 1.3, 0);
    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x5c4033,
      roughness: 0.95,
      flatShading: true,
    });

    const crownGeo = new THREE.ConeGeometry(2.3, 6.8, 6);
    crownGeo.translate(0, 5.4, 0);
    const crownMat = new THREE.MeshStandardMaterial({
      color: 0x2f5e3b,
      roughness: 0.88,
      flatShading: true,
    });

    this.trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, maxTrees);
    this.crowns = new THREE.InstancedMesh(crownGeo, crownMat, maxTrees);
    this.trunks.castShadow = true;
    this.crowns.castShadow = true;
    this.crowns.receiveShadow = true;

    const dummy = new THREE.Object3D();
    const tint = new THREE.Color();
    let placed = 0;
    let attempts = 0;

    while (placed < maxTrees && attempts < maxTrees * 5) {
      attempts++;
      const x = (rand() - 0.5) * 3200;
      const z = (rand() - 0.5) * 3200;
      const y = terrain.getHeight(x, z);

      // Solo plantar entre la orilla alta y línea alpina
      if (y < LAKE_LEVEL + 3.2 || y > 98) continue;

      // No plantar encima de helipuertos o puntos de interés
      let nearPad = false;
      for (let i = 0; i < WORLD_FLAT_ZONES.length; i++) {
        const zone = WORLD_FLAT_ZONES[i];
        if (Math.hypot(x - zone.x, z - zone.z) < zone.innerRadius + 14) {
          nearPad = true;
          break;
        }
      }
      if (nearPad) continue;

      // Evitar paredes demasiado verticales
      const slope = Math.abs(y - terrain.getHeight(x + 4, z + 4));
      if (slope > 2.4) continue;

      const scale = 0.75 + rand() * 0.85;
      dummy.position.set(x, y - 0.2, z);
      dummy.rotation.set(0, rand() * Math.PI * 2, 0);
      dummy.scale.set(scale, scale * (0.9 + rand() * 0.35), scale);
      dummy.updateMatrix();

      this.trunks.setMatrixAt(placed, dummy.matrix);
      this.crowns.setMatrixAt(placed, dummy.matrix);

      tint.setHSL(0.34 + (rand() - 0.5) * 0.05, 0.38, 0.24 + rand() * 0.1);
      this.crowns.setColorAt(placed, tint);
      placed++;
    }

    this.trunks.count = placed;
    this.crowns.count = placed;
    this.trunks.instanceMatrix.needsUpdate = true;
    this.crowns.instanceMatrix.needsUpdate = true;
    if (this.crowns.instanceColor) this.crowns.instanceColor.needsUpdate = true;

    this.group.add(this.trunks, this.crowns);
  }

  setShadowEnabled(enabled: boolean): void {
    this.trunks.castShadow = enabled;
    this.crowns.castShadow = enabled;
  }

  dispose(): void {
    this.trunks.geometry.dispose();
    (this.trunks.material as THREE.Material).dispose();
    this.crowns.geometry.dispose();
    (this.crowns.material as THREE.Material).dispose();
  }
}
