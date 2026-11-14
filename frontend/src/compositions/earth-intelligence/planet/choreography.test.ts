import { describe, expect, it } from 'vitest';
import { BURN_AT, BURN_CYCLE, BURN_R, burnCycle, coreHeat, heatAt, pinHeat } from './choreography';

describe('burn loop', () => {
  it('waits for the intro, then repeats every cycle', () => {
    expect(burnCycle(BURN_AT - 0.1, false)).toEqual({ active: false, c: 0 });
    expect(burnCycle(BURN_AT + BURN_CYCLE / 2, false).c).toBeCloseTo(0.5);
    expect(burnCycle(BURN_AT + BURN_CYCLE * 2.25, false).c).toBeCloseTo(0.25);
  });

  it('never runs with reduced motion', () => {
    expect(burnCycle(BURN_AT + 5, true).active).toBe(false);
  });

  it('burns, holds, then fully recovers before the loop ends', () => {
    expect(heatAt(0, 0)).toBe(0);
    expect(heatAt(0.1, 0)).toBe(1);
    expect(heatAt(0.5, 0)).toBeGreaterThan(0);
    expect(heatAt(0.5, 0)).toBeLessThan(1);
    expect(heatAt(0.9, 0)).toBe(0);
  });

  it('reaches farther places later', () => {
    expect(heatAt(0.02, 0)).toBeGreaterThan(heatAt(0.02, BURN_R * 0.5));
  });

  it('fades to nothing at the edge of the burn area', () => {
    expect(pinHeat(0.1, 0)).toBe(1);
    expect(pinHeat(0.1, BURN_R * 0.9)).toBeLessThan(0.25);
    expect(pinHeat(0.1, BURN_R)).toBe(0);
  });

  it('shows the study mark as burned until the loop starts', () => {
    expect(coreHeat({ active: false, c: 0 })).toBe(1);
    expect(coreHeat({ active: true, c: 0.9 })).toBe(0);
  });
});
