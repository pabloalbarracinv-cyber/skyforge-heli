// Parámetros físicos inspirados en Airbus H125 / Bell 407 (helicóptero ligero utilitario)
export interface HeliSpec {
  name: string;
  mass: number;               // kg
  inertia: { x: number; y: number; z: number }; // kg·m² (pitch, yaw, roll)
  rotorRadius: number;        // R (m)
  rotorBlades: number;        // número de palas
  nominalOmega: number;       // Ω nominal (rad/s) (~392 RPM -> 41.05 rad/s)
  maxCt: number;              // coeficiente de empuje máximo
  minCt: number;              // coeficiente de empuje mínimo (paso levemente negativo)
  inducedPowerFactor: number; // κ factor pérdidas inducidas (~1.15)
  profilePower: number;       // P0 potencia parásita de perfil (W)
  maxEnginePower: number;     // Potencia máxima de turbina (W) (~632 kW H125)
  tailRotorArm: number;       // Brazo del rotor de cola l_tr (m)
  maxTailThrust: number;      // Empuje máximo rotor de cola (N)
  cyclicPitchTorque: number;  // Momento máximo cabeceo (N·m)
  cyclicRollTorque: number;   // Momento máximo alabeo (N·m)
  angularDamping: { x: number; y: number; z: number }; // Amortiguamiento aerodinámico rotacional
  dragArea: { x: number; y: number; z: number };       // C_D * A_f por eje cuerpo (m²)
  weathercockStability: number; // Estabilidad direccional de cola (N·m por m/s lateral)
  skidHeight: number;         // Distancia CG a patines (m)
  skidHalfWidth: number;      // Semiancho entre patines (m)
  skidHalfLength: number;     // Semilargo de patines (m)
  crashVerticalSpeed: number; // m/s vertical límite (~3.6 m/s = 700 ft/min)
  crashTiltRad: number;       // Inclinación máxima al tocar suelo (rad) (~24°)
}

export const H125_SPEC: HeliSpec = {
  name: 'SF-125 Écureuil',
  mass: 1800,
  inertia: {
    x: 4200, // pitch (eje X derecha)
    y: 5100, // yaw (eje Y arriba)
    z: 1650, // roll (eje Z atrás/adelante)
  },
  rotorRadius: 5.35, // Área A = π * 5.35² ≈ 89.92 m²
  rotorBlades: 3,
  nominalOmega: 41.05, // ~392 RPM -> V_tip ≈ 219.6 m/s
  maxCt: 0.0092,       // T_max SL ≈ 0.0092 * 1.225 * 89.92 * 48230 ≈ 48,880 N (~2.76 g)
  minCt: -0.0008,
  inducedPowerFactor: 1.15,
  profilePower: 68000, // 68 kW perfil
  maxEnginePower: 635000, // 635 kW (~850 shp)
  tailRotorArm: 6.45,
  maxTailThrust: 3800, // Torque máx antipar ≈ 24,510 N·m (hover Q ≈ 7,200 N·m)
  cyclicPitchTorque: 13500,
  cyclicRollTorque: 9200,
  angularDamping: {
    x: 9800,
    y: 7400,
    z: 5800,
  },
  dragArea: {
    x: 3.4, // lateral
    y: 5.2, // vertical fuselaje
    z: 1.45, // frontal (velocidades crucero ~130-140 kt)
  },
  weathercockStability: 210,
  skidHeight: 1.55,
  skidHalfWidth: 1.15,
  skidHalfLength: 1.65,
  crashVerticalSpeed: 4.8, // ~945 ft/min tolerancia arcade-realista
  crashTiltRad: (26 * Math.PI) / 180,
};
