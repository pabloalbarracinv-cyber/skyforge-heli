import { describe, it, expect } from 'vitest';
import { H125_SPEC } from '../src/physics/heliSpec';
import { createRigidBodyState, integrateRigidBody, getAttitudeAngles } from '../src/physics/RigidBody';
import {
  computeHoverCollectiveOge,
  computeHoverPedalTrim,
  stepFlightAerodynamics,
} from '../src/physics/FlightModel';
import { getAirDensity } from '../src/physics/atmosphere';

describe('FlightModel — Física de Rotor', () => {
  it('mantiene hover OGE estable con deriva vertical < 0.1 m/s', () => {
    const body = createRigidBodyState(0, 60, 0); // 60 m sobre terreno -> fuera de efecto suelo
    const hoverColl = computeHoverCollectiveOge(H125_SPEC, 60);
    const hoverPedal = computeHoverPedalTrim(H125_SPEC, 60);
    const dt = 1 / 120;
    let omega = H125_SPEC.nominalOmega;

    for (let i = 0; i < 120; i++) {
      const step = stepFlightAerodynamics(
        body,
        {
          collective: hoverColl,
          cyclicPitch: 0,
          cyclicRoll: 0,
          yawPedal: hoverPedal,
          engineOn: true,
        },
        omega,
        0,
        H125_SPEC,
        dt
      );
      omega = step.nextRotorOmega;
      integrateRigidBody(body, step.worldForce, step.bodyTorque, H125_SPEC.mass, H125_SPEC.inertia, dt);
    }

    expect(Math.abs(body.velocity.y)).toBeLessThan(0.1);
    expect(Math.abs(body.angularVelocity.y)).toBeLessThan(0.05);
  });

  it('incrementa el empuje cuando entra en Efecto Suelo (Cheeseman-Bennett)', () => {
    const hoverColl = computeHoverCollectiveOge(H125_SPEC, 0);
    const controls = {
      collective: hoverColl,
      cyclicPitch: 0,
      cyclicRoll: 0,
      yawPedal: 0,
      engineOn: true,
    };

    const highBody = createRigidBodyState(0, 50, 0);
    const lowBody = createRigidBodyState(0, 2.2, 0); // patines a ~0.65m del suelo

    const oge = stepFlightAerodynamics(highBody, controls, H125_SPEC.nominalOmega, 0, H125_SPEC, 1 / 120);
    const ige = stepFlightAerodynamics(lowBody, controls, H125_SPEC.nominalOmega, 0, H125_SPEC, 1 / 120);

    expect(ige.telemetry.igeFactor).toBeGreaterThan(1.04);
    expect(ige.telemetry.thrustN).toBeGreaterThan(oge.telemetry.thrustN * 1.04);
  });

  it('produce guiñada por par reactivo en modo realista si no se aplica pedal', () => {
    const body = createRigidBodyState(0, 40, 0);
    const hoverColl = computeHoverCollectiveOge(H125_SPEC, 40);
    const dt = 1 / 120;

    for (let i = 0; i < 60; i++) {
      const step = stepFlightAerodynamics(
        body,
        { collective: hoverColl, cyclicPitch: 0, cyclicRoll: 0, yawPedal: 0, engineOn: true },
        H125_SPEC.nominalOmega,
        0,
        H125_SPEC,
        dt
      );
      integrateRigidBody(body, step.worldForce, step.bodyTorque, H125_SPEC.mass, H125_SPEC.inertia, dt);
    }

    // Sin pedal derecho, el fuselaje gira en sentido +Y (antihorario)
    expect(body.angularVelocity.y).toBeGreaterThan(0.25);
  });

  it('reduce densidad ISA con la altitud', () => {
    expect(getAirDensity(0)).toBeCloseTo(1.225, 3);
    expect(getAirDensity(2000)).toBeLessThan(1.05);
    expect(getAirDensity(2000)).toBeGreaterThan(0.95);
  });

  it('inclina la nariz abajo y avanza hacia -Z al aplicar cyclicPitch positivo', () => {
    const body = createRigidBodyState(0, 50, 0);
    const hoverColl = computeHoverCollectiveOge(H125_SPEC, 50);
    const hoverPedal = computeHoverPedalTrim(H125_SPEC, 50);
    const dt = 1 / 120;

    for (let i = 0; i < 90; i++) {
      const step = stepFlightAerodynamics(
        body,
        { collective: hoverColl + 0.04, cyclicPitch: 0.6, cyclicRoll: 0, yawPedal: hoverPedal, engineOn: true },
        H125_SPEC.nominalOmega,
        0,
        H125_SPEC,
        dt
      );
      integrateRigidBody(body, step.worldForce, step.bodyTorque, H125_SPEC.mass, H125_SPEC.inertia, dt);
    }

    const att = getAttitudeAngles(body.orientation);
    expect(att.pitch).toBeLessThan(-0.08); // nariz abajo
    expect(body.velocity.z).toBeLessThan(-0.5); // avanzando hacia el Norte (-Z)
  });
});
