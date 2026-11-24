import * as THREE from 'three';
import type { HeliSpec } from './heliSpec';
import type { RigidBodyState } from './RigidBody';
import { getAirDensity, GRAVITY } from './atmosphere';

export interface ControlInputs {
  collective: number; // 0..1
  cyclicPitch: number; // -1..1 (+1 inclina nariz abajo / avanzar, -1 nariz arriba / frenar)
  cyclicRoll: number;  // -1..1 (+1 alabeo derecha, -1 izquierda)
  yawPedal: number;    // -1..1 (+1 pedal derecho / nariz derecha, -1 pedal izquierdo)
  engineOn: boolean;
}

export interface FlightTelemetry {
  thrustN: number;
  inducedVelocity: number;
  igeFactor: number;        // >= 1.0 cuando hay efecto suelo
  etlFactor: number;        // sustentación traslacional efectiva
  powerWatts: number;
  torqueNm: number;         // par reactivo del rotor sobre el fuselaje
  torquePercent: number;    // % respecto a potencia máx de turbina
  rotorOmega: number;       // rad/s actual
  rotorRpmPercent: number;  // 0..105 %
  aglMeters: number;        // altura sobre el terreno (CG - skidHeight - terrainY)
  airSpeedMs: number;       // velocidad total
  forwardSpeedMs: number;   // velocidad hacia adelante (-Z cuerpo)
  lateralSpeedMs: number;   // velocidad lateral (+X cuerpo)
  verticalSpeedMs: number;  // velocidad vertical mundo
}

export interface GroundContactResult {
  onGround: boolean;
  crashed: boolean;
  crashReason?: string;
  normalForce: THREE.Vector3;
  contactTorque: THREE.Vector3;
}

const _bodyVel = new THREE.Vector3();
const _invQuat = new THREE.Quaternion();
const _thrustDirBody = new THREE.Vector3();
const _worldForce = new THREE.Vector3();
const _bodyForce = new THREE.Vector3();
const _bodyTorque = new THREE.Vector3();

// Calcula el colectivo exacto requerido para hover fuera de efecto suelo (OGE) a nivel del mar
export function computeHoverCollectiveOge(spec: HeliSpec, altitude = 0): number {
  const rho = getAirDensity(altitude);
  const area = Math.PI * spec.rotorRadius * spec.rotorRadius;
  const tipSpeedSq = Math.pow(spec.nominalOmega * spec.rotorRadius, 2);
  const weight = spec.mass * GRAVITY;
  const requiredCt = weight / (rho * area * tipSpeedSq);
  return Math.max(0, Math.min(1, (requiredCt - spec.minCt) / (spec.maxCt - spec.minCt)));
}

// Calcula el pedal antipar requerido para equilibrar el par de hover en modo realista
export function computeHoverPedalTrim(spec: HeliSpec, altitude = 0): number {
  const rho = getAirDensity(altitude);
  const area = Math.PI * spec.rotorRadius * spec.rotorRadius;
  const weight = spec.mass * GRAVITY;
  const vi = Math.sqrt(weight / (2 * rho * area));
  const power = spec.inducedPowerFactor * weight * vi + spec.profilePower;
  const mainTorque = power / spec.nominalOmega;
  const requiredTailThrust = mainTorque / spec.tailRotorArm;
  // Con rotor horario (visto desde arriba) o antihorario (H125 gira horario visto desde arriba -> fuselaje tiende a girar antihorario +Y, requiere pedal derecho +yawPedal que genera momento -Y)
  return Math.max(-1, Math.min(1, requiredTailThrust / spec.maxTailThrust));
}

export function stepFlightAerodynamics(
  body: RigidBodyState,
  controls: ControlInputs,
  rotorOmega: number,
  terrainHeightAtHeli: number,
  spec: HeliSpec,
  dt: number
): {
  worldForce: THREE.Vector3;
  bodyTorque: THREE.Vector3;
  nextRotorOmega: number;
  telemetry: FlightTelemetry;
} {
  // 1. Gobernador de RPM de turbina/rotor
  const targetOmega = controls.engineOn ? spec.nominalOmega : 0;
  const spoolRate = controls.engineOn ? 9.5 : 2.2; // rad/s² arranque suave y desaceleración inercial
  let nextOmega = rotorOmega;
  if (nextOmega < targetOmega) {
    nextOmega = Math.min(targetOmega, nextOmega + spoolRate * dt);
  } else if (nextOmega > targetOmega) {
    nextOmega = Math.max(targetOmega, nextOmega - spoolRate * dt);
  }

  const altitude = body.position.y;
  const rho = getAirDensity(altitude);
  const area = Math.PI * spec.rotorRadius * spec.rotorRadius;
  const agl = Math.max(0, body.position.y - spec.skidHeight - terrainHeightAtHeli);

  // Velocidad del aire en coordenadas del cuerpo
  _invQuat.copy(body.orientation).invert();
  _bodyVel.copy(body.velocity).applyQuaternion(_invQuat);

  const forwardSpeed = -_bodyVel.z;
  const lateralSpeed = _bodyVel.x;
  const horizAirspeed = Math.hypot(forwardSpeed, lateralSpeed);
  const totalAirspeed = body.velocity.length();

  // 2. Coeficiente de empuje según colectivo
  const clampedCollective = Math.max(0, Math.min(1, controls.collective));
  const ct = spec.minCt + clampedCollective * (spec.maxCt - spec.minCt);
  const tipSpeed = nextOmega * spec.rotorRadius;
  const baseThrust = ct * rho * area * tipSpeed * tipSpeed;

  // Velocidad inducida de referencia (momentum theory)
  const viHover = Math.sqrt(Math.max(1, Math.abs(baseThrust)) / (2 * rho * area));

  // 3. Efecto Suelo — Cheeseman-Bennett: T_IGE / T_OGE = 1 / (1 - (R / 4z)²)
  // z = altura del disco rotor sobre el terreno (agl + ~3.1 m del patín al rotor)
  const rotorHeightZ = Math.max(0.5 * spec.rotorRadius, agl + 3.1);
  const ratioR4Z = spec.rotorRadius / (4 * rotorHeightZ);
  // Atenuar efecto suelo con velocidad horizontal alta (se pierde sobre ~25 kt)
  const igeSpeedFade = Math.max(0, 1 - horizAirspeed / 14);
  const rawIge = 1 / (1 - ratioR4Z * ratioR4Z);
  const igeFactor = 1 + (rawIge - 1) * igeSpeedFade;

  // 4. Sustentación Traslacional Efectiva (ETL) — ganancia suave entre 8 y 25 m/s (~15-48 kt)
  const advanceRatio = horizAirspeed / Math.max(3.5, viHover);
  const etlBell = advanceRatio > 0.6
    ? 0.085 * Math.min(1, (advanceRatio - 0.6) / 1.4) * Math.exp(-Math.max(0, advanceRatio - 2.4) * 0.25)
    : 0;
  const etlFactor = 1 + etlBell;

  // Amortiguamiento axial de ascenso/descenso del disco rotor
  const axialVelDamping = 1 - Math.max(-0.22, Math.min(0.22, _bodyVel.y / Math.max(12, viHover * 2.4)));
  const totalThrust = Math.max(-2500, baseThrust * igeFactor * etlFactor * axialVelDamping);

  // Dirección del vector de empuje en cuerpo (ligera inclinación por cíclico ~7°)
  const maxTiltRad = 0.12;
  _thrustDirBody
    .set(
      controls.cyclicRoll * maxTiltRad,
      1,
      controls.cyclicPitch * maxTiltRad // cyclicPitch +1 = inclinar hacia -Z (avanzar): z negativo
    );
  _thrustDirBody.z = -controls.cyclicPitch * maxTiltRad;
  _thrustDirBody.normalize();

  // 5. Potencia y Par reactivo del rotor principal
  // En vuelo traslacional la velocidad inducida efectiva disminuye: vi_eff = viHover / sqrt(1 + (V/viHover)²)
  const viEffective = viHover / Math.sqrt(1 + Math.pow(horizAirspeed / Math.max(4, viHover), 2));
  const inducedPower = spec.inducedPowerFactor * Math.max(0, totalThrust) * viEffective;
  const omegaRatio = nextOmega / spec.nominalOmega;
  const profilePower = spec.profilePower * Math.pow(omegaRatio, 3);
  const totalPower = nextOmega > 1 ? inducedPower + profilePower : 0;
  const mainRotorTorque = nextOmega > 2 ? totalPower / nextOmega : 0;

  // 6. Arrastre parásito del fuselaje en ejes cuerpo: D = -0.5 * ρ * CdA * |v| * v
  const dragX = -0.5 * rho * spec.dragArea.x * Math.abs(_bodyVel.x) * _bodyVel.x;
  const dragY = -0.5 * rho * spec.dragArea.y * Math.abs(_bodyVel.y) * _bodyVel.y;
  const dragZ = -0.5 * rho * spec.dragArea.z * Math.abs(_bodyVel.z) * _bodyVel.z;

  // Sumar fuerzas en cuerpo y transformar a mundo
  _bodyForce.copy(_thrustDirBody).multiplyScalar(totalThrust);
  _bodyForce.x += dragX;
  _bodyForce.y += dragY;
  _bodyForce.z += dragZ;

  _worldForce.copy(_bodyForce).applyQuaternion(body.orientation);
  // Gravedad
  _worldForce.y -= spec.mass * GRAVITY;

  // 7. Momentos (Torques) en ejes cuerpo
  const rotorAuthority = Math.min(1, Math.pow(omegaRatio, 2));

  // Pitch (+X es nariz arriba; cyclicPitch +1 pide nariz abajo -> torque negativo en X)
  const pitchMoment = -controls.cyclicPitch * spec.cyclicPitchTorque * rotorAuthority;
  // Roll (+Z apunta hacia atrás; rotar alrededor de -Z a la derecha es -Z torque: verifiquemos mano derecha:
  // pulgar en +Z (atrás), dedos van de +X (derecha) hacia +Y (arriba) -> alabea a la IZQUIERDA!
  // Por tanto, alabeo a la DERECHA (cyclicRoll = +1, bajar +X) requiere torque -Z!
  const rollMoment = -controls.cyclicRoll * spec.cyclicRollTorque * rotorAuthority;

  // Par reactivo del rotor principal tiende a girar el fuselaje a la izquierda (+Y)
  // El pedal derecho (yawPedal = +1) empuja para girar nariz a la derecha (-Y)
  const tailThrust = controls.yawPedal * spec.maxTailThrust * rotorAuthority;
  const antiTorqueMoment = -tailThrust * spec.tailRotorArm;

  // Efecto veleta del estabilizador vertical: si hay viento desde la derecha (_bodyVel.x > 0),
  // empuja la cola hacia la izquierda -> nariz gira a la derecha (-Y)
  const weathercockMoment = -_bodyVel.x * spec.weathercockStability * Math.min(1.6, 0.35 + horizAirspeed * 0.04);

  // Estabilidad pendular suave del fuselaje bajo el rotor
  const dampX = -body.angularVelocity.x * spec.angularDamping.x;
  const dampY = -body.angularVelocity.y * spec.angularDamping.y;
  const dampZ = -body.angularVelocity.z * spec.angularDamping.z;

  _bodyTorque.set(
    pitchMoment + dampX,
    mainRotorTorque + antiTorqueMoment + weathercockMoment + dampY,
    rollMoment + dampZ
  );

  const torquePercent = Math.min(130, (totalPower / spec.maxEnginePower) * 100);

  return {
    worldForce: _worldForce.clone(),
    bodyTorque: _bodyTorque.clone(),
    nextRotorOmega: nextOmega,
    telemetry: {
      thrustN: totalThrust,
      inducedVelocity: viEffective,
      igeFactor,
      etlFactor,
      powerWatts: totalPower,
      torqueNm: mainRotorTorque,
      torquePercent,
      rotorOmega: nextOmega,
      rotorRpmPercent: (nextOmega / spec.nominalOmega) * 100,
      aglMeters: agl,
      airSpeedMs: totalAirspeed,
      forwardSpeedMs: forwardSpeed,
      lateralSpeedMs: lateralSpeed,
      verticalSpeedMs: body.velocity.y,
    },
  };
}
