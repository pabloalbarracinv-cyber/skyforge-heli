import * as THREE from 'three';

// Convención de ejes cuerpo (Three.js):
// +X: Derecha | +Y: Arriba | -Z: Adelante (nariz apunta a -Z)
// Pitch positivo (+X): nariz arriba | Roll positivo (+Z): alabeo a la izquierda (o -Z derecha)
// Yaw positivo (+Y): giro a la izquierda (antihorario visto desde arriba)
export interface RigidBodyState {
  position: THREE.Vector3;
  velocity: THREE.Vector3;        // m/s en espacio mundo
  orientation: THREE.Quaternion;  // rotación cuerpo -> mundo
  angularVelocity: THREE.Vector3; // rad/s en espacio cuerpo (x=pitch, y=yaw, z=roll)
}

export function createRigidBodyState(x = 0, y = 0, z = 0, headingRad = 0): RigidBodyState {
  const orientation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), headingRad);
  return {
    position: new THREE.Vector3(x, y, z),
    velocity: new THREE.Vector3(),
    orientation,
    angularVelocity: new THREE.Vector3(),
  };
}

export function cloneRigidBodyState(s: RigidBodyState): RigidBodyState {
  return {
    position: s.position.clone(),
    velocity: s.velocity.clone(),
    orientation: s.orientation.clone(),
    angularVelocity: s.angularVelocity.clone(),
  };
}

const _qDelta = new THREE.Quaternion();
const _omegaQuat = new THREE.Quaternion();

// Integración Euler semi-implícita estable a 120 Hz
export function integrateRigidBody(
  state: RigidBodyState,
  worldForce: THREE.Vector3,
  bodyTorque: THREE.Vector3,
  mass: number,
  inertia: { x: number; y: number; z: number },
  dt: number
): void {
  // 1. Velocidad lineal y posición
  state.velocity.addScaledVector(worldForce, dt / mass);
  state.position.addScaledVector(state.velocity, dt);

  // 2. Velocidad angular en cuerpo (incluye término giroscópico ω × (I·ω))
  const wx = state.angularVelocity.x;
  const wy = state.angularVelocity.y;
  const wz = state.angularVelocity.z;

  const Iwx = inertia.x * wx;
  const Iwy = inertia.y * wy;
  const IwZ = inertia.z * wz;

  // ω × (I·ω)
  const gyroX = wy * IwZ - wz * Iwy;
  const gyroY = wz * Iwx - wx * IwZ;
  const gyroZ = wx * Iwy - wy * Iwx;

  state.angularVelocity.x += ((bodyTorque.x - gyroX) / inertia.x) * dt;
  state.angularVelocity.y += ((bodyTorque.y - gyroY) / inertia.y) * dt;
  state.angularVelocity.z += ((bodyTorque.z - gyroZ) / inertia.z) * dt;

  // Limitar velocidades angulares extremas por estabilidad numérica
  state.angularVelocity.clampLength(0, 8.0);

  // 3. Integrar cuaternión: dq/dt = 0.5 * q * ω_body
  _omegaQuat.set(
    state.angularVelocity.x * 0.5 * dt,
    state.angularVelocity.y * 0.5 * dt,
    state.angularVelocity.z * 0.5 * dt,
    0
  );
  _qDelta.multiplyQuaternions(state.orientation, _omegaQuat);
  state.orientation.x += _qDelta.x;
  state.orientation.y += _qDelta.y;
  state.orientation.z += _qDelta.z;
  state.orientation.w += _qDelta.w;
  state.orientation.normalize();
}

// Extrae pitch (rad), roll (rad) y heading (0..2π rad, 0=Norte/-Z, π/2=Este/+X)
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3();

export interface AttitudeAngles {
  pitch: number;   // + nariz arriba (rad)
  roll: number;    // + alabeo derecha (rad)
  heading: number; // 0..2π (0 = Norte -Z, π/2 = Este +X)
}

export function getAttitudeAngles(q: THREE.Quaternion): AttitudeAngles {
  _forward.set(0, 0, -1).applyQuaternion(q);
  _right.set(1, 0, 0).applyQuaternion(q);
  _up.set(0, 1, 0).applyQuaternion(q);

  const pitch = Math.asin(Math.max(-1, Math.min(1, _forward.y)));
  // Alabeo derecha positivo cuando el ala derecha (+X) baja (_right.y < 0)
  const roll = Math.atan2(-_right.y, _up.y);
  // Rumbo náutico: Norte = -Z (0°), Este = +X (90°), Sur = +Z (180°), Oeste = -X (270°)
  let heading = Math.atan2(_forward.x, -_forward.z);
  if (heading < 0) heading += Math.PI * 2;

  return { pitch, roll, heading };
}
