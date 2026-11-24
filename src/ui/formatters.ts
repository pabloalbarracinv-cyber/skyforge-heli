import type { UnitSystem } from '../persistence/SaveStore';

export function formatAltitude(meters: number, units: UnitSystem): { value: string; unit: string } {
  if (units === 'aviation') {
    return { value: Math.round(meters * 3.28084).toString(), unit: 'FT' };
  }
  return { value: Math.round(meters).toString(), unit: 'M' };
}

export function formatSpeed(ms: number, units: UnitSystem): { value: string; unit: string } {
  if (units === 'aviation') {
    return { value: Math.round(ms * 1.94384).toString(), unit: 'KT' };
  }
  return { value: Math.round(ms * 3.6).toString(), unit: 'KM/H' };
}

export function formatVsi(ms: number, units: UnitSystem): { value: string; unit: string } {
  if (units === 'aviation') {
    const fpm = Math.round((ms * 196.85) / 10) * 10;
    return { value: (fpm >= 0 ? `+${fpm}` : `${fpm}`), unit: 'FPM' };
  }
  const v = ms.toFixed(1);
  return { value: ms >= 0 ? `+${v}` : v, unit: 'M/S' };
}

export function formatClock(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const tenths = Math.floor((seconds % 1) * 10);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${tenths}`;
}
