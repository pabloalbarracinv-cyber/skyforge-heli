import * as THREE from 'three';
import type { MissionId } from '../persistence/SaveStore';
import { WORLD_FLAT_ZONES } from '../world/Terrain';

export interface MissionDefinition {
  id: MissionId;
  title: string;
  subtitle: string;
  description: string;
  difficulty: 'Libre' | 'Cadete' | 'Piloto' | 'Experto';
  threeStarSec: number;
  twoStarSec: number;
  spawn: { x: number; z: number; headingDeg: number };
}

export const MISSIONS: MissionDefinition[] = [
  {
    id: 'free_flight',
    title: 'Vuelo Libre — Valle SkyForge',
    subtitle: 'Exploración sin cronómetro',
    description:
      'Despega desde el Helipuerto Base y explora libremente los 16 km² del valle, el Faro Costero, el Mirador Norte y el Refugio Alpino.',
    difficulty: 'Libre',
    threeStarSec: 0,
    twoStarSec: 0,
    spawn: { x: 0, z: 0, headingDeg: 35 },
  },
  {
    id: 'precision_landing',
    title: 'Aterrizaje de Precisión — Faro del Lago',
    subtitle: 'Navegación visual y toque suave',
    description:
      'Cruza hacia el noreste sobre la costa del lago y posa los patines con suavidad dentro del helipuerto azul de la Península del Faro.',
    difficulty: 'Cadete',
    threeStarSec: 58,
    twoStarSec: 85,
    spawn: { x: 0, z: 0, headingDeg: 42 },
  },
  {
    id: 'ring_circuit',
    title: 'Circuito Aéreo — Anillos del Cañón',
    subtitle: '6 portales luminosos + regreso a base',
    description:
      'Atraviesa en orden los 6 anillos dorados suspendidos sobre el valle y el lago, y finaliza aterrizando de vuelta en el Helipuerto Base.',
    difficulty: 'Piloto',
    threeStarSec: 95,
    twoStarSec: 135,
    spawn: { x: 0, z: 0, headingDeg: 25 },
  },
  {
    id: 'alpine_rescue',
    title: 'Operación Rescate — Refugio Alpino Sur',
    subtitle: 'Extracción en hover y evacuación a base',
    description:
      'Vuela al Refugio Alpino Sur, mantén un vuelo estacionario bajo (< 12 m) sobre la baliza de humo durante 4 segundos para embarcar al montañista y tráelo sano al Helipuerto Base.',
    difficulty: 'Experto',
    threeStarSec: 120,
    twoStarSec: 170,
    spawn: { x: 0, z: 0, headingDeg: 195 },
  },
];

export interface MissionLiveStatus {
  missionId: MissionId;
  elapsedSec: number;
  objectiveText: string;
  progressCurrent: number;
  progressTotal: number;
  rescueHoldProgress: number; // 0..1 durante extracción
  targetPosition: { x: number; y: number; z: number } | null;
  targetDistanceMeters: number | null;
  targetBearingDeg: number | null; // rumbo absoluto hacia objetivo
  completed: boolean;
  failed: boolean;
  failReason: string | null;
  score: number;
  stars: 1 | 2 | 3;
}

const RING_WAYPOINTS = [
  { x: 95, yOffset: 28, z: -120 },
  { x: 245, yOffset: 32, z: -225 },
  { x: 375, yOffset: 26, z: -360 },
  { x: 240, yOffset: 38, z: -430 },
  { x: 75, yOffset: 36, z: -290 },
  { x: -35, yOffset: 26, z: -135 },
];

export class MissionSystem {
  readonly group = new THREE.Group();

  private activeId: MissionId = 'free_flight';
  private elapsedSec = 0;
  private stepIndex = 0;
  private rescueHoldSec = 0;
  private completed = false;
  private failed = false;
  private failReason: string | null = null;
  private score = 0;
  private stars: 1 | 2 | 3 = 1;

  private ringMeshes: THREE.Mesh[] = [];
  private beaconBeam: THREE.Mesh;
  private rescueZoneRing: THREE.Mesh;

  private getSurfaceHeight: (x: number, z: number) => number;
  private onCheckpointPing?: (high: boolean) => void;

  constructor(
    getSurfaceHeight: (x: number, z: number) => number,
    onCheckpointPing?: (high: boolean) => void
  ) {
    this.getSurfaceHeight = getSurfaceHeight;
    this.onCheckpointPing = onCheckpointPing;

    // Haz vertical guía para aterrizajes/extracción
    const beamGeo = new THREE.CylinderGeometry(1.6, 5.5, 85, 16, 1, true);
    beamGeo.translate(0, 42.5, 0);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.beaconBeam = new THREE.Mesh(beamGeo, beamMat);
    this.beaconBeam.visible = false;
    this.group.add(this.beaconBeam);

    // Anillo de extracción en suelo
    const rzGeo = new THREE.RingGeometry(7.2, 8.8, 32);
    rzGeo.rotateX(-Math.PI / 2);
    this.rescueZoneRing = new THREE.Mesh(
      rzGeo,
      new THREE.MeshBasicMaterial({ color: 0xef4444, side: THREE.DoubleSide })
    );
    this.rescueZoneRing.visible = false;
    this.group.add(this.rescueZoneRing);

    // Anillos del circuito
    const torusGeo = new THREE.TorusGeometry(10.5, 0.75, 10, 28);
    for (let i = 0; i < RING_WAYPOINTS.length; i++) {
      const wp = RING_WAYPOINTS[i];
      const groundY = this.getSurfaceHeight(wp.x, wp.z);
      const ring = new THREE.Mesh(
        torusGeo,
        new THREE.MeshStandardMaterial({
          color: 0xf59e0b,
          emissive: 0xb45309,
          emissiveIntensity: 0.45,
          roughness: 0.3,
        })
      );
      ring.position.set(wp.x, groundY + wp.yOffset, wp.z);

      // Orientar cada anillo mirando hacia el siguiente punto
      const next = RING_WAYPOINTS[i + 1] ?? { x: 0, yOffset: 18, z: 0 };
      const nextY = this.getSurfaceHeight(next.x, next.z) + next.yOffset;
      ring.lookAt(next.x, nextY, next.z);
      ring.visible = false;
      this.ringMeshes.push(ring);
      this.group.add(ring);
    }
  }

  startMission(id: MissionId): MissionDefinition {
    this.activeId = id;
    this.elapsedSec = 0;
    this.stepIndex = 0;
    this.rescueHoldSec = 0;
    this.completed = false;
    this.failed = false;
    this.failReason = null;
    this.score = 0;
    this.stars = 1;

    this.refreshVisuals();
    return MISSIONS.find((m) => m.id === id) ?? MISSIONS[0];
  }

  fail(reason: string): void {
    if (this.completed || this.failed) return;
    this.failed = true;
    this.failReason = reason;
  }

  private refreshVisuals(): void {
    for (let i = 0; i < this.ringMeshes.length; i++) {
      const r = this.ringMeshes[i];
      r.visible = this.activeId === 'ring_circuit' && i >= this.stepIndex;
      const mat = r.material as THREE.MeshStandardMaterial;
      if (i === this.stepIndex) {
        mat.color.setHex(0x22c55e);
        mat.emissive.setHex(0x15803d);
        r.scale.setScalar(1.12);
      } else {
        mat.color.setHex(0xf59e0b);
        mat.emissive.setHex(0x92400e);
        r.scale.setScalar(0.95);
      }
    }

    const basePad = WORLD_FLAT_ZONES[0];
    const lightPad = WORLD_FLAT_ZONES[1];
    const cabinPad = WORLD_FLAT_ZONES[3];

    this.beaconBeam.visible = false;
    this.rescueZoneRing.visible = false;

    if (this.activeId === 'precision_landing') {
      this.beaconBeam.visible = true;
      (this.beaconBeam.material as THREE.MeshBasicMaterial).color.setHex(0x38bdf8);
      this.beaconBeam.position.set(lightPad.x, lightPad.targetHeight, lightPad.z);
    } else if (this.activeId === 'ring_circuit' && this.stepIndex >= RING_WAYPOINTS.length) {
      this.beaconBeam.visible = true;
      (this.beaconBeam.material as THREE.MeshBasicMaterial).color.setHex(0x22c55e);
      this.beaconBeam.position.set(basePad.x, basePad.targetHeight, basePad.z);
    } else if (this.activeId === 'alpine_rescue') {
      this.beaconBeam.visible = true;
      if (this.stepIndex === 0) {
        (this.beaconBeam.material as THREE.MeshBasicMaterial).color.setHex(0xef4444);
        this.beaconBeam.position.set(cabinPad.x, cabinPad.targetHeight, cabinPad.z);
        this.rescueZoneRing.visible = true;
        this.rescueZoneRing.position.set(cabinPad.x, cabinPad.targetHeight + 0.68, cabinPad.z);
      } else {
        (this.beaconBeam.material as THREE.MeshBasicMaterial).color.setHex(0x22c55e);
        this.beaconBeam.position.set(basePad.x, basePad.targetHeight, basePad.z);
      }
    }
  }

  update(
    heliPos: THREE.Vector3,
    heliSpeedMs: number,
    landedCleanly: boolean,
    dt: number
  ): MissionLiveStatus {
    if (!this.completed && !this.failed) {
      this.elapsedSec += dt;
    }

    const basePad = WORLD_FLAT_ZONES[0];
    const lightPad = WORLD_FLAT_ZONES[1];
    const cabinPad = WORLD_FLAT_ZONES[3];

    let target: { x: number; y: number; z: number } | null = null;
    let objectiveText = 'Vuelo libre: explora el valle, el lago y los helipuertos de montaña';
    let progressCurrent = 0;
    let progressTotal = 0;

    if (this.activeId === 'precision_landing') {
      progressTotal = 1;
      target = { x: lightPad.x, y: lightPad.targetHeight, z: lightPad.z };
      const distHoriz = Math.hypot(heliPos.x - lightPad.x, heliPos.z - lightPad.z);
      objectiveText =
        distHoriz < 35
          ? 'Desciende suave y posa los patines dentro de la "H" del Faro'
          : 'Vuela hacia el noreste hasta el Helipuerto de la Península del Faro';

      if (!this.completed && !this.failed && landedCleanly && distHoriz < 9.5 && this.elapsedSec > 5) {
        progressCurrent = 1;
        this.finishMission(distHoriz);
      }
    } else if (this.activeId === 'ring_circuit') {
      progressTotal = RING_WAYPOINTS.length + 1;
      progressCurrent = this.stepIndex;

      if (this.stepIndex < RING_WAYPOINTS.length) {
        const ringMesh = this.ringMeshes[this.stepIndex];
        target = { x: ringMesh.position.x, y: ringMesh.position.y, z: ringMesh.position.z };
        objectiveText = `Atraviesa el anillo ${this.stepIndex + 1} de ${RING_WAYPOINTS.length}`;

        const d3 = heliPos.distanceTo(ringMesh.position);
        if (!this.completed && !this.failed && d3 < 12.2) {
          this.stepIndex++;
          this.onCheckpointPing?.(false);
          this.refreshVisuals();
        }
      } else {
        target = { x: basePad.x, y: basePad.targetHeight, z: basePad.z };
        objectiveText = '¡Circuito superado! Regresa y aterriza en el Helipuerto Base';
        const distBase = Math.hypot(heliPos.x - basePad.x, heliPos.z - basePad.z);
        if (!this.completed && !this.failed && landedCleanly && distBase < 12) {
          progressCurrent = progressTotal;
          this.finishMission(distBase);
        }
      }
    } else if (this.activeId === 'alpine_rescue') {
      progressTotal = 2;
      progressCurrent = this.stepIndex;

      if (this.stepIndex === 0) {
        target = { x: cabinPad.x, y: cabinPad.targetHeight, z: cabinPad.z };
        const distHoriz = Math.hypot(heliPos.x - cabinPad.x, heliPos.z - cabinPad.z);
        const aglOverPad = heliPos.y - cabinPad.targetHeight;

        if (distHoriz < 13 && aglOverPad > 0.8 && aglOverPad < 14 && heliSpeedMs < 4.5) {
          this.rescueHoldSec = Math.min(4.0, this.rescueHoldSec + dt);
          objectiveText = `Mantén hover estable para izar al montañista (${Math.round((this.rescueHoldSec / 4) * 100)}%)`;
          if (this.rescueHoldSec >= 4.0) {
            this.stepIndex = 1;
            this.onCheckpointPing?.(true);
            this.refreshVisuals();
          }
        } else {
          this.rescueHoldSec = Math.max(0, this.rescueHoldSec - dt * 0.8);
          objectiveText =
            distHoriz < 40
              ? 'Mantén hover bajo (< 12 m) sobre la zona roja durante 4 s'
              : 'Dirígete al sur hacia la baliza roja del Refugio Alpino';
        }
      } else {
        target = { x: basePad.x, y: basePad.targetHeight, z: basePad.z };
        objectiveText = 'Montañista a bordo: evacúalo y aterriza suave en el Helipuerto Base';
        const distBase = Math.hypot(heliPos.x - basePad.x, heliPos.z - basePad.z);
        if (!this.completed && !this.failed && landedCleanly && distBase < 12) {
          progressCurrent = 2;
          this.finishMission(distBase);
        }
      }
    }

    let targetDistanceMeters: number | null = null;
    let targetBearingDeg: number | null = null;
    if (target) {
      const dx = target.x - heliPos.x;
      const dz = target.z - heliPos.z;
      targetDistanceMeters = Math.hypot(dx, dz);
      let deg = (Math.atan2(dx, -dz) * 180) / Math.PI;
      if (deg < 0) deg += 360;
      targetBearingDeg = deg;
    }

    // Pulso suave del haz guía
    if (this.beaconBeam.visible) {
      const mat = this.beaconBeam.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.16 + Math.sin(this.elapsedSec * 3.2) * 0.07;
    }

    return {
      missionId: this.activeId,
      elapsedSec: this.elapsedSec,
      objectiveText,
      progressCurrent,
      progressTotal,
      rescueHoldProgress: this.rescueHoldSec / 4.0,
      targetPosition: target,
      targetDistanceMeters,
      targetBearingDeg,
      completed: this.completed,
      failed: this.failed,
      failReason: this.failReason,
      score: this.score,
      stars: this.stars,
    };
  }

  private finishMission(landingErrorMeters: number): void {
    this.completed = true;
    this.beaconBeam.visible = false;
    this.onCheckpointPing?.(true);

    const def = MISSIONS.find((m) => m.id === this.activeId);
    if (!def || def.id === 'free_flight') {
      this.stars = 3;
      this.score = 1000;
      return;
    }

    if (this.elapsedSec <= def.threeStarSec) {
      this.stars = 3;
    } else if (this.elapsedSec <= def.twoStarSec) {
      this.stars = 2;
    } else {
      this.stars = 1;
    }

    const precisionBonus = Math.round(Math.max(0, 10 - landingErrorMeters) * 45);
    const timeScore = Math.round(Math.max(400, 2500 - this.elapsedSec * 12));
    this.score = timeScore + precisionBonus;
  }
}
