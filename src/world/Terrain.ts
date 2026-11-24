import * as THREE from 'three';
import { SeededNoise2D, WORLD_SEED, WORLD_SIZE, LAKE_LEVEL } from './seed';

// Puntos planos diseñados para helipuertos y puntos de interés
export interface FlatZone {
  id: string;
  name: string;
  x: number;
  z: number;
  targetHeight: number;
  innerRadius: number;
  outerRadius: number;
}

export const WORLD_FLAT_ZONES: FlatZone[] = [
  {
    id: 'base',
    name: 'Helipuerto Base SkyForge',
    x: 0,
    z: 0,
    targetHeight: 18,
    innerRadius: 28,
    outerRadius: 95,
  },
  {
    id: 'lighthouse',
    name: 'Península del Faro',
    x: 430,
    z: -480,
    targetHeight: 16,
    innerRadius: 22,
    outerRadius: 75,
  },
  {
    id: 'mountain_pad',
    name: 'Mirador Cima Norte',
    x: -520,
    z: -680,
    targetHeight: 118,
    innerRadius: 20,
    outerRadius: 95,
  },
  {
    id: 'rescue_cabin',
    name: 'Refugio Alpino Sur',
    x: -360,
    z: 540,
    targetHeight: 74,
    innerRadius: 22,
    outerRadius: 80,
  },
];

// Cuenca del lago al Este-Noreste
export const LAKE_CENTER = { x: 340, z: -210, radius: 330 };

export class TerrainSystem {
  private noise = new SeededNoise2D(WORLD_SEED);
  readonly mesh: THREE.Mesh;

  constructor(segments = 240) {
    const geometry = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, segments, segments);
    geometry.rotateX(-Math.PI / 2);

    const pos = geometry.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const color = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = this.getHeight(x, z);
      pos.setY(i, y);

      // Coloración por bioma y pendiente aproximada
      const slopeSample = Math.abs(y - this.getRawTerrainHeight(x + 6, z + 6));
      if (y < LAKE_LEVEL + 1.4) {
        // Arena cálida / orilla
        color.setHex(0xd8c398);
      } else if (y < 38) {
        // Pradera valle verde oliva suave
        color.setHex(slopeSample > 2.8 ? 0x6f7b66 : 0x5f8d4e);
      } else if (y < 92) {
        // Bosque alpino y roca
        color.setHex(slopeSample > 2.5 ? 0x6c737a : 0x436d47);
      } else if (y < 142) {
        // Roca de alta montaña
        color.setHex(0x787d82);
      } else {
        // Cumbres nevadas
        color.setHex(0xf1f5f9);
      }

      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      flatShading: true,
      roughness: 0.92,
      metalness: 0.03,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.receiveShadow = true;
  }

  private smoothstep(edge0: number, edge1: number, x: number): number {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  }

  private getRawTerrainHeight(x: number, z: number): number {
    const n1 = this.noise.fbm(x * 0.00075, z * 0.00075, 5); // grandes cordilleras (-0.6..0.6)
    const n2 = this.noise.fbm(x * 0.0024 + 11.3, z * 0.0024 - 7.1, 3); // colinas medias
    const ridge = 1 - Math.abs(this.noise.noise(x * 0.0011 - 4.2, z * 0.0011 + 8.7));

    // Valle suave en el centro y montañas más altas conforme nos alejamos (>550 m)
    const distFromOrigin = Math.hypot(x, z);
    const valleyMask = this.smoothstep(140, 950, distFromOrigin);

    let h = 16 + n1 * 72 + n2 * 18 + Math.pow(ridge, 2.4) * 95 * valleyMask;

    // Esculpir cuenca del lago
    const dLake = Math.hypot(x - LAKE_CENTER.x, z - LAKE_CENTER.z);
    if (dLake < LAKE_CENTER.radius + 140) {
      const lakeBlend = 1 - this.smoothstep(LAKE_CENTER.radius * 0.45, LAKE_CENTER.radius + 140, dLake);
      h = h * (1 - lakeBlend) + -4.5 * lakeBlend;
    }

    return h;
  }

  getHeight(x: number, z: number): number {
    let h = this.getRawTerrainHeight(x, z);

    for (let i = 0; i < WORLD_FLAT_ZONES.length; i++) {
      const zone = WORLD_FLAT_ZONES[i];
      const d = Math.hypot(x - zone.x, z - zone.z);
      if (d < zone.outerRadius) {
        const blend = 1 - this.smoothstep(zone.innerRadius, zone.outerRadius, d);
        h = h * (1 - blend) + zone.targetHeight * blend;
      }
    }

    return h;
  }

  // Superficie sólida o agua para cálculos de contacto y altitud AGL
  getSurfaceHeight(x: number, z: number): number {
    return Math.max(LAKE_LEVEL, this.getHeight(x, z));
  }

  isWater(x: number, z: number): boolean {
    return this.getHeight(x, z) < LAKE_LEVEL - 0.15;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
