import { describe, it, expect } from 'vitest';
import { H125_SPEC } from '../src/physics/heliSpec';
import { createRigidBodyState, integrateRigidBody, getAttitudeAngles } from '../src/physics/RigidBody';
import { stepFlightAerodynamics } from '../src/physics/FlightModel';
import { FlightAssist } from '../src/physics/FlightAssist';

describe('FlightAssist — Estabilización PID', () => {
  it('converge a VSI ≈ 0 y actitud nivelada con colectivo neutro (0.5)', () => {
    const assist = new FlightAssist();
    const body = createRigidBodyState(0, 45, 0);
    // Perturbación inicial: cayendo a -2.5 m/s e inclinado
    body.velocity.set(1.5, -2.5, -2.0);
    body.angularVelocity.set(0.25, -0.3, 0.2);

    const dt = 1 / 120;
    let omega = H125_SPEC.nominalOmega;
    let lastTorque = 7200;

    for (let i = 0; i < 480; i++) {
      const assisted = assist.apply(
        { collective: 0.5, cyclicPitch: 0, cyclicRoll: 0, yawPedal: 0, engineOn: true },
        body,
        H125_SPEC,
        false,
        lastTorque,
        omega,
        dt
      );
      const step = stepFlightAerodynamics(body, assisted, omega, 0, H125_SPEC, dt);
      omega = step.nextRotorOmega;
      lastTorque = step.telemetry.torqueNm;
      integrateRigidBody(body, step.worldForce, step.bodyTorque, H125_SPEC.mass, H125_SPEC.inertia, dt);
    }

    const att = getAttitudeAngles(body.orientation);
    expect(Math.abs(body.velocity.y)).toBeLessThan(0.15);
    expect(Math.abs(att.pitch)).toBeLessThan(0.08);
    expect(Math.abs(att.roll)).toBeLessThan(0.08);
    expect(Math.abs(body.angularVelocity.y)).toBeLessThan(0.06);
  });
});
