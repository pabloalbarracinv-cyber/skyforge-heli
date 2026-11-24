import * as THREE from 'three';
import type { HeliSpec } from './heliSpec';
import type { RigidBodyState } from './RigidBody';
import { getAttitudeAngles } from './RigidBody';

export interface GroundState {
  onGround: boolean;
  landedCleanly: boolean;
  crashed: boolean;
  crashReason: string | null;
  impactSpeed: number;
}

const SKID_OFFSETS = [
  new THREE.Vector3(-1, -1, -1), // delantero izquierdo
  new THREE.Vector3(1, -1, -1),  // delantero derecho
  new THREE.Vector3(-1, -1, 1),  // trasero izquierdo
  new THREE.Vector3(1, -1, 1),   // trasero derecho
];

const _localPt = new THREE.Vector3();
const _worldPt = new THREE.Vector3();
const _relPos = new THREE.Vector3();
const _ptVel = new THREE.Vector3();
const _angVelWorld = new THREE.Vector3();
const _forceSum = new THREE.Vector3();
const _torqueWorldSum = new THREE.Vector3();
const _ptForce = new THREE.Vector3();
const _ptTorque = new THREE.Vector3();
const _invQuat = new THREE.Quaternion();

export function resolveGroundContact(
  body: RigidBodyState,
  spec: HeliSpec,
  sampleTerrainHeight: (x: number, z: number) => number,
  isWaterAt?: (x: number, z: number) => boolean
): {
  worldForce: THREE.Vector3;
  bodyTorque: THREE.Vector3;
  groundState: GroundState;
} {
  _forceSum.set(0, 0, 0);
  _torqueWorldSum.set(0, 0, 0);
  _angVelWorld.copy(body.angularVelocity).applyQuaternion(body.orientation);

  const springK = 52000;   // N/m por punto de patín (4 puntos -> ~208 kN/m)
  const damperC = 11500;   // N·s/m vertical
  const frictionLateral = 9500;

  let contacts = 0;
  let maxPenetration = 0;
  let touchedWater = false;

  for (let i = 0; i < SKID_OFFSETS.length; i++) {
    const off = SKID_OFFSETS[i];
    _localPt.set(
      off.x * spec.skidHalfWidth,
      -spec.skidHeight,
      off.z * spec.skidHalfLength
    );
    _relPos.copy(_localPt).applyQuaternion(body.orientation);
    _worldPt.copy(body.position).add(_relPos);

    const groundY = sampleTerrainHeight(_worldPt.x, _worldPt.z);
    const penetration = groundY - _worldPt.y;

    if (penetration > 0) {
      contacts++;
      if (penetration > maxPenetration) maxPenetration = penetration;
      if (isWaterAt && isWaterAt(_worldPt.x, _worldPt.z)) {
        touchedWater = true;
      }

      // Velocidad del punto de contacto: v_cg + ω_world × r
      _ptVel.crossVectors(_angVelWorld, _relPos).add(body.velocity);

      const normalForceY = Math.max(0, springK * penetration - damperC * _ptVel.y);
      // Fricción horizontal proporcional a carga normal para evitar deslizamiento eterno
      const maxFriction = normalForceY * 0.85;
      const fx = Math.max(-maxFriction, Math.min(maxFriction, -_ptVel.x * frictionLateral));
      const fz = Math.max(-maxFriction, Math.min(maxFriction, -_ptVel.z * frictionLateral));

      _ptForce.set(fx, normalForceY, fz);
      _forceSum.add(_ptForce);

      _ptTorque.crossVectors(_relPos, _ptForce);
      _torqueWorldSum.add(_ptTorque);
    }
  }

  // Verificar golpe del rotor o fuselaje superior contra el suelo
  const centerGround = sampleTerrainHeight(body.position.x, body.position.z);
  const attitude = getAttitudeAngles(body.orientation);
  const tiltMag = Math.hypot(attitude.pitch, attitude.roll);

  let crashed = false;
  let crashReason: string | null = null;
  const downwardSpeed = Math.max(0, -body.velocity.y);

  if (touchedWater && contacts > 0 && downwardSpeed > 0.5) {
    crashed = true;
    crashReason = 'Impacto sobre el lago (helicóptero sin flotadores anfibios)';
  } else if (contacts > 0) {
    if (downwardSpeed > spec.crashVerticalSpeed) {
      crashed = true;
      crashReason = `Descenso brusco (${Math.round(downwardSpeed * 196.85)} ft/min > límite estructural)`;
    } else if (tiltMag > spec.crashTiltRad && maxPenetration > 0.08) {
      crashed = true;
      crashReason = `Inclinación excesiva al tocar tierra (${Math.round((tiltMag * 180) / Math.PI)}°)`;
    }
  }

  if (body.position.y - centerGround < 0.45) {
    crashed = true;
    crashReason = crashReason ?? 'Colisión estructural del fuselaje con el terreno';
    body.position.y = centerGround + 0.45;
  }

  // Limitar penetración máxima para evitar rebote explosivo
  if (maxPenetration > 0.35 && !crashed) {
    body.position.y += maxPenetration - 0.35;
  }

  _invQuat.copy(body.orientation).invert();
  const bodyTorque = _torqueWorldSum.clone().applyQuaternion(_invQuat);

  const speedTotal = body.velocity.length();
  const onGround = contacts >= 2 && maxPenetration > 0.002;
  const landedCleanly = onGround && !crashed && speedTotal < 0.8 && tiltMag < 0.16;

  return {
    worldForce: _forceSum.clone(),
    bodyTorque,
    groundState: {
      onGround,
      landedCleanly,
      crashed,
      crashReason,
      impactSpeed: downwardSpeed,
    },
  };
}
