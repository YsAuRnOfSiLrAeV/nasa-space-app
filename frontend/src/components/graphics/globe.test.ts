import { describe, expect, it } from 'vitest';
import { LIGHT, angularDistance, graticuleLines, lambert, orbitPoint, parallel } from './globe';

describe('globe light', () => {
  it('is a unit vector from the upper left, towards the viewer', () => {
    expect(Math.hypot(...LIGHT)).toBeCloseTo(1);
    expect(LIGHT[0]).toBeLessThan(0);
    expect(LIGHT[1]).toBeLessThan(0);
    expect(LIGHT[2]).toBeGreaterThan(0);
  });

  it('is brightest facing the light and zero on the far side', () => {
    expect(lambert(LIGHT[0], LIGHT[1], LIGHT[2])).toBeCloseTo(1);
    expect(lambert(-LIGHT[0], -LIGHT[1], -LIGHT[2])).toBe(0);
  });
});

describe('graticule', () => {
  it('has 12 meridians and 7 parallels, sampled at the given step', () => {
    const lines = graticuleLines(4);
    expect(lines).toHaveLength(12 + 7);
    expect(lines[0]).toHaveLength(43); // -84…84 every 4°
    expect(graticuleLines(6)[0]).toHaveLength(29);
  });

  it('draws a parallel all the way round at one latitude', () => {
    const p = parallel(51.6, 3);
    expect(p[0]).toEqual([-180, 51.6]);
    expect(p.at(-1)).toEqual([180, 51.6]);
    expect(p.every(([, lat]) => lat === 51.6)).toBe(true);
  });
});

describe('orbitPoint', () => {
  const lats = (incl: number) =>
    Array.from({ length: 721 }, (_, k) => orbitPoint(incl, 20, (k / 720) * Math.PI * 2)[1]);

  it('starts at the ascending node on the equator', () => {
    const [lon, lat] = orbitPoint(51.6, 28, 0);
    expect(lon).toBeCloseTo(28);
    expect(lat).toBeCloseTo(0);
  });

  it('reaches, but never passes, the inclination as its highest latitude', () => {
    expect(Math.max(...lats(51.6))).toBeCloseTo(51.6, 1);
    expect(Math.min(...lats(51.6))).toBeCloseTo(-51.6, 1);
  });

  it('turns back short of the pole for a retrograde (sun-synchronous) orbit', () => {
    expect(Math.max(...lats(98.2))).toBeCloseTo(180 - 98.2, 1);
  });
});

describe('angularDistance', () => {
  it('is zero at the same point and 90° from the pole to the equator', () => {
    expect(angularDistance([-94, 50], [-94, 50])).toBeCloseTo(0);
    expect(angularDistance([0, 90], [123, 0])).toBeCloseTo(90);
  });

  it('shrinks degrees of longitude towards the poles', () => {
    expect(angularDistance([0, 60], [10, 60])).toBeLessThan(angularDistance([0, 0], [10, 0]));
  });
});
