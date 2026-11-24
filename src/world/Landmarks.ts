import * as THREE from 'three';
import { WORLD_FLAT_ZONES } from './Terrain';

export function buildHelipadMesh(radius = 11, accentHex = 0xf59e0b): THREE.Group {
  const group = new THREE.Group();

  // Base octogonal de concreto elevado
  const padGeo = new THREE.CylinderGeometry(radius, radius + 1.4, 0.6, 8);
  padGeo.translate(0, 0.3, 0);
  const padMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.85,
    flatShading: true,
  });
  const pad = new THREE.Mesh(padGeo, padMat);
  pad.receiveShadow = true;
  pad.castShadow = true;
  group.add(pad);

  // Anillo perimetral amarillo aeronáutico
  const ringGeo = new THREE.RingGeometry(radius * 0.74, radius * 0.84, 24);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({ color: accentHex });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.y = 0.62;
  group.add(ring);

  // Letra "H" central blanca
  const hMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
  const barLeft = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.05, 6.6), hMat);
  barLeft.position.set(-2.3, 0.63, 0);
  const barRight = barLeft.clone();
  barRight.position.x = 2.3;
  const barCross = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.05, 1.1), hMat);
  barCross.position.set(0, 0.63, 0);
  group.add(barLeft, barRight, barCross);

  // Balizas perimetrales verdes/ámbar
  const beaconGeo = new THREE.SphereGeometry(0.24, 8, 8);
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const b = new THREE.Mesh(beaconGeo, beaconMat);
    b.position.set(Math.cos(angle) * (radius - 0.5), 0.72, Math.sin(angle) * (radius - 0.5));
    group.add(b);
  }

  return group;
}

export class WorldLandmarks {
  readonly group = new THREE.Group();
  private windsock: THREE.Mesh;
  private lighthouseBeam: THREE.Mesh;

  constructor() {
    const baseZone = WORLD_FLAT_ZONES[0];
    const lighthouseZone = WORLD_FLAT_ZONES[1];
    const mountainZone = WORLD_FLAT_ZONES[2];
    const cabinZone = WORLD_FLAT_ZONES[3];

    // 1. Helipuerto Base + Hangar SkyForge + Manga de viento
    const mainPad = buildHelipadMesh(12, 0xf59e0b);
    mainPad.position.set(baseZone.x, baseZone.targetHeight, baseZone.z);
    this.group.add(mainPad);

    const hangar = this.createHangar();
    hangar.position.set(baseZone.x - 24, baseZone.targetHeight, baseZone.z - 12);
    this.group.add(hangar);

    const sockGroup = new THREE.Group();
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.1, 6.5, 6),
      new THREE.MeshStandardMaterial({ color: 0xcbd5e1 })
    );
    pole.position.y = 3.25;
    this.windsock = new THREE.Mesh(
      new THREE.ConeGeometry(0.45, 2.4, 8, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xf97316, side: THREE.DoubleSide })
    );
    this.windsock.rotation.z = -Math.PI / 2;
    this.windsock.position.set(1.2, 6.2, 0);
    sockGroup.add(pole, this.windsock);
    sockGroup.position.set(baseZone.x + 15, baseZone.targetHeight, baseZone.z - 12);
    this.group.add(sockGroup);

    // 2. Faro costero junto al lago + Helipuerto secundario
    const lightPad = buildHelipadMesh(9, 0x38bdf8);
    lightPad.position.set(lighthouseZone.x, lighthouseZone.targetHeight, lighthouseZone.z);
    this.group.add(lightPad);

    const { lighthouse, beam } = this.createLighthouse();
    this.lighthouseBeam = beam;
    lighthouse.position.set(lighthouseZone.x + 16, lighthouseZone.targetHeight, lighthouseZone.z - 12);
    this.group.add(lighthouse);

    // 3. Helipuerto Mirador Norte + Torre de comunicaciones
    const mountainPad = buildHelipadMesh(9.5, 0xfacc15);
    mountainPad.position.set(mountainZone.x, mountainZone.targetHeight, mountainZone.z);
    this.group.add(mountainPad);

    const radioTower = this.createRadioTower();
    radioTower.position.set(mountainZone.x - 16, mountainZone.targetHeight, mountainZone.z - 14);
    this.group.add(radioTower);

    // 4. Cabaña Alpina de Rescate Sur + Zona de aterrizaje
    const rescuePad = buildHelipadMesh(8.5, 0xef4444);
    rescuePad.position.set(cabinZone.x, cabinZone.targetHeight, cabinZone.z);
    this.group.add(rescuePad);

    const cabin = this.createAlpineCabin();
    cabin.position.set(cabinZone.x - 15, cabinZone.targetHeight, cabinZone.z + 10);
    this.group.add(cabin);
  }

  private createHangar(): THREE.Group {
    const g = new THREE.Group();
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xe2dfd7, roughness: 0.8, flatShading: true });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x1e4b85, roughness: 0.6, flatShading: true });

    const body = new THREE.Mesh(new THREE.BoxGeometry(16, 7, 20), wallMat);
    body.position.y = 3.5;
    body.castShadow = true;
    body.receiveShadow = true;

    const roof = new THREE.Mesh(new THREE.CylinderGeometry(8.3, 8.3, 20.4, 8, 1, false, 0, Math.PI), roofMat);
    roof.rotation.z = Math.PI / 2;
    roof.rotation.y = Math.PI / 2;
    roof.position.y = 7;
    roof.castShadow = true;

    const door = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 5.4, 12),
      new THREE.MeshStandardMaterial({ color: 0x1e293b })
    );
    door.position.set(8.05, 2.7, 0);

    g.add(body, roof, door);
    return g;
  }

  private createLighthouse(): { lighthouse: THREE.Group; beam: THREE.Mesh } {
    const g = new THREE.Group();
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, flatShading: true });
    const redMat = new THREE.MeshStandardMaterial({ color: 0xc2410c, flatShading: true });

    const s1 = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.3, 7, 8), whiteMat);
    s1.position.y = 3.5;
    const s2 = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.6, 7, 8), redMat);
    s2.position.y = 10.5;
    const s3 = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 2.1, 6, 8), whiteMat);
    s3.position.y = 17;
    const lantern = new THREE.Mesh(
      new THREE.CylinderGeometry(1.5, 1.5, 2.8, 8),
      new THREE.MeshBasicMaterial({ color: 0xfef08a })
    );
    lantern.position.y = 21.4;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(2.1, 2.4, 8), redMat);
    cap.position.y = 24;

    s1.castShadow = true;
    s2.castShadow = true;
    s3.castShadow = true;

    const beamGeo = new THREE.ConeGeometry(5, 36, 12, 1, true);
    beamGeo.translate(0, -18, 0);
    beamGeo.rotateZ(Math.PI / 2);
    const beam = new THREE.Mesh(
      beamGeo,
      new THREE.MeshBasicMaterial({
        color: 0xfef9c3,
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    beam.position.y = 21.4;

    g.add(s1, s2, s3, lantern, cap, beam);
    return { lighthouse: g, beam };
  }

  private createRadioTower(): THREE.Group {
    const g = new THREE.Group();
    const steel = new THREE.MeshStandardMaterial({ color: 0x94a3b8, wireframe: true });
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 3.2, 28, 4, 6), steel);
    tower.position.y = 14;
    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xef4444 })
    );
    beacon.position.y = 28.4;
    g.add(tower, beacon);
    return g;
  }

  private createAlpineCabin(): THREE.Group {
    const g = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: 0x7c4a27, flatShading: true });
    const roof = new THREE.MeshStandardMaterial({ color: 0x991b1b, flatShading: true });
    const base = new THREE.Mesh(new THREE.BoxGeometry(8, 4.2, 6.5), wood);
    base.position.y = 2.1;
    base.castShadow = true;
    const top = new THREE.Mesh(new THREE.ConeGeometry(6.2, 3.8, 4), roof);
    top.rotation.y = Math.PI / 4;
    top.position.y = 6.0;
    top.castShadow = true;
    g.add(base, top);
    return g;
  }

  update(elapsedSec: number): void {
    this.windsock.rotation.y = Math.sin(elapsedSec * 2.1) * 0.18;
    this.lighthouseBeam.rotation.y = elapsedSec * 0.9;
  }
}
