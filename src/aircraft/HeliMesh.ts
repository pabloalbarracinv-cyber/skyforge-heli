import * as THREE from 'three';
import type { HeliSpec } from '../physics/heliSpec';

// Construye un helicóptero ligero inspirado en Airbus H125 / Bell 407 en ejes cuerpo:
// Nariz apunta hacia -Z, Cola hacia +Z, Derecha +X, Arriba +Y.
// Centro de gravedad (0,0,0) ubicado a `spec.skidHeight` sobre la base de los patines.
export class HeliMesh {
  readonly root = new THREE.Group();
  readonly mainRotorPivot = new THREE.Group();
  readonly mainBladesGroup = new THREE.Group();
  readonly rotorBlurDisc: THREE.Mesh;
  readonly tailRotorGroup = new THREE.Group();
  readonly cockpitAnchor = new THREE.Object3D();

  private mainAngle = 0;
  private tailAngle = 0;

  constructor(spec: HeliSpec) {
    const bodyPaint = new THREE.MeshStandardMaterial({
      color: 0x1e4b85, // Azul Blueprint SkyForge
      roughness: 0.32,
      metalness: 0.28,
      flatShading: true,
    });
    const creamPaint = new THREE.MeshStandardMaterial({
      color: 0xf6f1e6, // Crema Pergamino
      roughness: 0.4,
      metalness: 0.12,
      flatShading: true,
    });
    const accentPaint = new THREE.MeshStandardMaterial({
      color: 0xd97706, // Ámbar cobre
      roughness: 0.38,
      metalness: 0.25,
      flatShading: true,
    });
    const darkMetal = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.55,
      metalness: 0.65,
      flatShading: true,
    });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0xbae6fd,
      roughness: 0.08,
      metalness: 0.5,
      transparent: true,
      opacity: 0.42,
    });

    // 1. Fuselaje principal aerodinámico
    const cabinLower = new THREE.Mesh(new THREE.BoxGeometry(1.75, 1.05, 3.5), bodyPaint);
    cabinLower.position.set(0, -0.15, -0.35);
    cabinLower.castShadow = true;
    this.root.add(cabinLower);

    // Franja crema lateral Picasso Tech
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.28, 3.52), creamPaint);
    stripe.position.set(0, -0.05, -0.35);
    this.root.add(stripe);

    // Nariz redondeada delantera (-Z)
    const noseGeo = new THREE.SphereGeometry(0.88, 12, 10);
    noseGeo.scale(0.96, 0.72, 1.35);
    const nose = new THREE.Mesh(noseGeo, bodyPaint);
    nose.position.set(0, -0.22, -2.05);
    nose.castShadow = true;
    this.root.add(nose);

    // Cúpula acristalada de cabina
    const canopyGeo = new THREE.SphereGeometry(0.92, 12, 10);
    canopyGeo.scale(0.94, 0.85, 1.55);
    const canopy = new THREE.Mesh(canopyGeo, glassMat);
    canopy.position.set(0, 0.36, -1.05);
    this.root.add(canopy);

    // Carenado superior de turbina y transmisión
    const cowling = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.68, 2.35), creamPaint);
    cowling.position.set(0, 0.68, 0.35);
    cowling.castShadow = true;
    this.root.add(cowling);

    const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.65, 8), darkMetal);
    exhaust.rotation.x = Math.PI / 2 - 0.2;
    exhaust.position.set(0, 0.72, 1.65);
    this.root.add(exhaust);

    // 2. Botalón de cola (+Z)
    const tailBoom = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.42, 5.4, 8), bodyPaint);
    tailBoom.rotation.x = Math.PI / 2;
    tailBoom.position.set(0, 0.32, 3.9);
    tailBoom.castShadow = true;
    this.root.add(tailBoom);

    // Estabilizador horizontal
    const hStab = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.08, 0.48), accentPaint);
    hStab.position.set(0, 0.32, 5.2);
    this.root.add(hStab);

    // Deriva vertical (aleta superior e inferior)
    const vFinTop = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.45, 0.75), accentPaint);
    vFinTop.position.set(0, 0.88, 6.35);
    vFinTop.rotation.x = -0.22;
    vFinTop.castShadow = true;
    this.root.add(vFinTop);

    // 3. Patines de aterrizaje (base exacta en y = -spec.skidHeight)
    const skidY = -spec.skidHeight + 0.06;
    const skidTubeGeo = new THREE.CylinderGeometry(0.06, 0.06, spec.skidHalfLength * 2.25, 8);
    skidTubeGeo.rotateX(Math.PI / 2);

    for (const side of [-1, 1]) {
      const skid = new THREE.Mesh(skidTubeGeo, darkMetal);
      skid.position.set(side * spec.skidHalfWidth, skidY, -0.2);
      skid.castShadow = true;
      this.root.add(skid);

      // Puntas curvas delanteras del patín
      const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.55, 6), darkMetal);
      tip.rotation.x = Math.PI / 3;
      tip.position.set(side * spec.skidHalfWidth, skidY + 0.14, -0.2 - spec.skidHalfLength * 1.18);
      this.root.add(tip);

      // Montantes transversales (struts)
      for (const zOff of [-1.05, 0.75]) {
        const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.15, 6), darkMetal);
        strut.position.set(side * (spec.skidHalfWidth * 0.72), skidY + 0.48, zOff);
        strut.rotation.z = side * 0.36;
        this.root.add(strut);
      }
    }

    // 4. Mástil y Rotor Principal (3 palas de radio spec.rotorRadius)
    this.mainRotorPivot.position.set(0, 1.38, 0.0);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.55, 8), darkMetal);
    mast.position.y = -0.18;
    this.mainRotorPivot.add(mast);

    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.26, 0.18, 8), darkMetal);
    this.mainBladesGroup.add(hub);

    const bladeLen = spec.rotorRadius;
    const bladeGeo = new THREE.BoxGeometry(0.32, 0.035, bladeLen);
    bladeGeo.translate(0, 0, bladeLen / 2);
    const tipGeo = new THREE.BoxGeometry(0.33, 0.04, 0.45);

    for (let i = 0; i < spec.rotorBlades; i++) {
      const holder = new THREE.Group();
      holder.rotation.y = (i / spec.rotorBlades) * Math.PI * 2;
      const blade = new THREE.Mesh(bladeGeo, darkMetal);
      blade.castShadow = true;
      const yellowTip = new THREE.Mesh(tipGeo, accentPaint);
      yellowTip.position.set(0, 0, bladeLen - 0.22);
      holder.add(blade, yellowTip);
      this.mainBladesGroup.add(holder);
    }
    this.mainRotorPivot.add(this.mainBladesGroup);

    // Disco semitransparente de blur a alta velocidad
    const discGeo = new THREE.RingGeometry(0.45, spec.rotorRadius, 36);
    discGeo.rotateX(-Math.PI / 2);
    const discMat = new THREE.MeshBasicMaterial({
      color: 0x334155,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.rotorBlurDisc = new THREE.Mesh(discGeo, discMat);
    this.rotorBlurDisc.position.y = 0.03;
    this.mainRotorPivot.add(this.rotorBlurDisc);

    this.root.add(this.mainRotorPivot);

    // 5. Rotor de cola en x = +0.2, y = 0.72, z = spec.tailRotorArm
    this.tailRotorGroup.position.set(0.18, 0.72, spec.tailRotorArm);
    const tailBladeGeo = new THREE.BoxGeometry(0.03, 0.16, 1.55);
    const tb1 = new THREE.Mesh(tailBladeGeo, darkMetal);
    const tb2 = new THREE.Mesh(tailBladeGeo, accentPaint);
    tb2.rotation.x = Math.PI / 2;
    this.tailRotorGroup.add(tb1, tb2);
    this.root.add(this.tailRotorGroup);

    // 6. Ancla de cámara de cabina (asiento piloto derecho H125)
    this.cockpitAnchor.position.set(0.32, 0.42, -1.15);
    this.root.add(this.cockpitAnchor);
  }

  update(
    rotorOmega: number,
    nominalOmega: number,
    cyclicPitch: number,
    cyclicRoll: number,
    dt: number
  ): void {
    // Giro horario visto desde arriba (-Y)
    this.mainAngle -= rotorOmega * dt;
    this.tailAngle += rotorOmega * 4.8 * dt;

    this.mainBladesGroup.rotation.y = this.mainAngle;
    this.tailRotorGroup.rotation.x = this.tailAngle;

    // Inclinación visual del plato cíclico
    this.mainRotorPivot.rotation.x = -cyclicPitch * 0.11;
    this.mainRotorPivot.rotation.z = -cyclicRoll * 0.11;

    const rpmRatio = Math.min(1, rotorOmega / nominalOmega);
    const discMat = this.rotorBlurDisc.material as THREE.MeshBasicMaterial;
    discMat.opacity = rpmRatio > 0.45 ? (rpmRatio - 0.45) * 0.34 : 0;
  }
}
