// Atmósfera Estándar Internacional (ISA) simplificada para troposfera
const RHO_SEA_LEVEL = 1.225; // kg/m³
const TEMP_SEA_LEVEL = 288.15; // K (15 °C)
const LAPSE_RATE = 0.0065; // K/m
const GRAVITY = 9.80665; // m/s²
const GAS_CONSTANT = 287.058; // J/(kg·K)

export { GRAVITY, RHO_SEA_LEVEL };

export function getAirDensity(altitudeMeters: number): number {
  const h = Math.max(0, Math.min(11000, altitudeMeters));
  const tempRatio = 1 - (LAPSE_RATE * h) / TEMP_SEA_LEVEL;
  const exponent = GRAVITY / (GAS_CONSTANT * LAPSE_RATE) - 1; // ~4.25588
  return RHO_SEA_LEVEL * Math.pow(tempRatio, exponent);
}
