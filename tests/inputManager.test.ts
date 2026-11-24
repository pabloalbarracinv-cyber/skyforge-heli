import { describe, it, expect } from 'vitest';
import { shapeAxis } from '../src/input/types';
import { InputManager } from '../src/input/InputManager';

describe('InputManager & shapeAxis', () => {
  it('aplica zona muerta exacta y mantiene extremos -1 y +1', () => {
    expect(shapeAxis(0.05, 0.08)).toBe(0);
    expect(shapeAxis(-0.07, 0.08)).toBe(0);
    expect(shapeAxis(1, 0.08)).toBeCloseTo(1, 5);
    expect(shapeAxis(-1, 0.08)).toBeCloseTo(-1, 5);
    // Con curva expo la mitad del recorrido es más suave que lineal
    const mid = shapeAxis(0.5, 0.08, 0.4);
    expect(mid).toBeGreaterThan(0.15);
    expect(mid).toBeLessThan(0.46);
  });

  it('cambia automáticamente la fuente activa a táctil cuando el usuario usa controles táctiles', () => {
    const manager = new InputManager();
    manager.resetForSpawn(true);

    const initial = manager.update(1 / 60, true, true);
    expect(initial.activeDevice).toBe('keyboard');

    manager.touch.setCyclic(0.45, -0.3, true);
    manager.touch.setLeftStick(0.1, 0.75, true);

    const touched = manager.update(1 / 60, true, false);
    expect(touched.activeDevice).toBe('touch');
    expect(touched.controls.cyclicRoll).toBeCloseTo(0.45, 3);
    expect(touched.controls.collective).toBeCloseTo(0.75, 3);
  });
});
