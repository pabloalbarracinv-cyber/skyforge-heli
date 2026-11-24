import type { HeliSpec } from './heliSpec';
import type { RigidBodyState } from './RigidBody';
import { getAttitudeAngles } from './RigidBody';
import type { ControlInputs } from './FlightModel';
import { computeHoverCollectiveOge } from './FlightModel';

export type FlightMode = 'assisted' | 'realistic';

// En modo Asistido:
// - Colectivo: 0.5 mantiene VSI = 0 m/s (hover automático); >0.5 sube hasta +8 m/s; <0.5 baja hasta -6 m/s.
//   Cuando está posado en tierra y el piloto baja el mando (<0.25), corta colectivo para asentar patines.
// - Cíclico: comanda ángulo objetivo de pitch/roll (±24°) con auto-nivelado suave al soltar + amortiguación de deriva en hover.
// - Pedales: compensa automáticamente el par del rotor principal + mantiene velocidad de guiñada comandada.
export class FlightAssist {
  private vsiIntegral = 0;

  reset(): void {
    this.vsiIntegral = 0;
  }

  apply(
    raw: ControlInputs,
    body: RigidBodyState,
    spec: HeliSpec,
    onGround: boolean,
    currentTorqueNm: number,
    rotorOmega: number,
    dt: number
  ): ControlInputs {
    if (!raw.engineOn) {
      this.vsiIntegral = 0;
      return raw;
    }

    const attitude = getAttitudeAngles(body.orientation);
    const omegaRatio = Math.max(0.2, rotorOmega / spec.nominalOmega);

    // 1. Colectivo asistido (controlador PI sobre velocidad vertical)
    const hoverColl = computeHoverCollectiveOge(spec, body.position.y);
    const centeredThrottle = (raw.collective - 0.5) * 2; // -1..+1
    let collectiveOut: number;

    if (onGround && raw.collective < 0.42) {
      // Mantener posado en helipuerto hasta que suba colectivo por encima del centro
      this.vsiIntegral = 0;
      collectiveOut = raw.collective * 0.55;
    } else {
      const deadbandThrottle = Math.abs(centeredThrottle) < 0.08 ? 0 : centeredThrottle;
      const targetVsi = deadbandThrottle >= 0 ? deadbandThrottle * 8.5 : deadbandThrottle * 6.0;
      const vsiError = targetVsi - body.velocity.y;

      this.vsiIntegral = Math.max(-0.22, Math.min(0.22, this.vsiIntegral + vsiError * dt * 0.08));
      // Compensar pérdida de componente vertical al inclinar el disco: 1 / cos(tilt)
      const tiltComp = 1 / Math.max(0.75, Math.cos(attitude.pitch) * Math.cos(attitude.roll));
      collectiveOut = hoverColl * tiltComp + vsiError * 0.055 + this.vsiIntegral;
    }

    // 2. Cíclico asistido (control PD de actitud + frenado suave traslacional al soltar mandos)
    const maxAngle = (24 * Math.PI) / 180;
    let targetPitch = -raw.cyclicPitch * maxAngle; // cyclicPitch +1 = inclinar nariz abajo (pitch negativo)
    let targetRoll = raw.cyclicRoll * maxAngle;    // cyclicRoll +1 = alabeo derecha (roll positivo)

    // Si el usuario suelta el cíclico a baja velocidad, ayudar a frenar deriva residual para hover limpio
    if (Math.abs(raw.cyclicPitch) < 0.05 && Math.abs(raw.cyclicRoll) < 0.05 && !onGround) {
      const cosH = Math.cos(attitude.heading);
      const sinH = Math.sin(attitude.heading);
      // Forward mundo: (sinH, 0, -cosH), Right mundo: (cosH, 0, sinH)
      const fwdVel = body.velocity.x * sinH - body.velocity.z * cosH;
      const rightVel = body.velocity.x * cosH + body.velocity.z * sinH;

      if (Math.hypot(fwdVel, rightVel) < 12) {
        targetPitch += Math.max(-0.14, Math.min(0.14, fwdVel * 0.022));
        targetRoll += Math.max(-0.14, Math.min(0.14, -rightVel * 0.022));
      }
    }

    // Error de pitch (+X cuerpo = nariz arriba; cyclicPitch +1 produce torque -X nariz abajo)
    const pitchError = targetPitch - attitude.pitch;
    const cyclicPitchOut = -(pitchError * 2.6 - body.angularVelocity.x * 0.85);

    // Error de roll (roll positivo = derecha; cyclicRoll +1 produce torque -Z derecha)
    const rollError = targetRoll - attitude.roll;
    const cyclicRollOut = rollError * 2.6 + body.angularVelocity.z * 0.75;

    // 3. Antipar + control de velocidad de guiñada (yaw rate)
    // yawPedal +1 pide girar a la derecha (angularVelocity.y negativa)
    const targetYawRate = -raw.yawPedal * 1.15; // rad/s
    const yawRateError = targetYawRate - body.angularVelocity.y;
    // Feed-forward exacto del par principal: mainTorque / (tailArm * maxTailThrust * omegaRatio²)
    const torqueFeedForward =
      currentTorqueNm / Math.max(400, spec.tailRotorArm * spec.maxTailThrust * omegaRatio * omegaRatio);
    const yawPedalOut = torqueFeedForward - yawRateError * 0.95;

    return {
      collective: Math.max(0, Math.min(1, collectiveOut)),
      cyclicPitch: Math.max(-1, Math.min(1, cyclicPitchOut)),
      cyclicRoll: Math.max(-1, Math.min(1, cyclicRollOut)),
      yawPedal: Math.max(-1, Math.min(1, yawPedalOut)),
      engineOn: raw.engineOn,
    };
  }
}
