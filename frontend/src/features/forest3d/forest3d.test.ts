import { describe, expect, it } from 'vitest';
import { contourSegments, createHeightField, rng } from './heightField';
import { ILLUSTRATIVE_STAND, standFromInput } from './recoveryAdapter';
import { scatterPlants } from './scatter';

describe('forest 3D: synthetic terrain', () => {
  const field = createHeightField({ size: 60, res: 61, seed: 3, relief: 10 });

  it('is deterministic for a seed', () => {
    const again = createHeightField({ size: 60, res: 61, seed: 3, relief: 10 });
    expect(Array.from(again.heights)).toEqual(Array.from(field.heights));
    expect(createHeightField({ size: 60, res: 61, seed: 4 }).heights).not.toEqual(field.heights);
  });

  it('spans exactly 0 … relief', () => {
    const hs = Array.from(field.heights);
    expect(Math.min(...hs)).toBeCloseTo(0, 6);
    expect(Math.max(...hs)).toBeCloseTo(10, 6);
  });

  it('samples grid points exactly and clamps outside the block', () => {
    expect(field.sample(-30, -30)).toBeCloseTo(field.heights[0]!, 6);
    expect(field.sample(30, 30)).toBeCloseTo(field.heights[61 * 61 - 1]!, 6);
    expect(field.sample(-99, -99)).toBeCloseTo(field.heights[0]!, 6);
  });

  it('traces contour segments at their level, inside the block', () => {
    const { minor, index } = contourSegments(field, 1, 5);
    expect(minor.length % 6).toBe(0);
    for (let k = 0; k < minor.length; k += 3) {
      expect(Math.abs(minor[k]!)).toBeLessThanOrEqual(30 + 1e-9);
      expect(Number.isInteger(Math.round(minor[k + 1]! * 1e6) / 1e6)).toBe(true);
    }
    for (let k = 1; k < index.length; k += 3) expect(index[k]! % 5).toBeCloseTo(0, 6);
  });
});

describe('forest 3D: plant scatter', () => {
  const field = createHeightField({ size: 80, res: 81, seed: 5 });
  const plants = scatterPlants(field, ILLUSTRATIVE_STAND);

  it('is deterministic', () => {
    expect(scatterPlants(field, ILLUSTRATIVE_STAND)).toEqual(plants);
  });

  it('places every plant on the ground, inside the block, out of the stream', () => {
    expect(plants.length).toBeGreaterThan(200);
    for (const p of plants) {
      expect(Math.abs(p.x)).toBeLessThanOrEqual(40);
      expect(Math.abs(p.z)).toBeLessThanOrEqual(40);
      expect(p.y).toBeCloseTo(field.sample(p.x, p.z), 6);
      expect(field.streamDistance(p.x, p.z)).toBeGreaterThan(1.1);
      expect(p.height).toBeGreaterThan(0);
    }
  });

  it('draws every silhouette', () => {
    const kinds = new Set(plants.map((p) => p.kind));
    for (const k of ['spruce', 'fir', 'pine', 'broadleaf', 'snag', 'shrub'])
      expect(kinds).toContain(k);
  });
});

describe('forest 3D: adapter', () => {
  it('keeps the illustrative stand until recovery inputs are wired', () => {
    expect(standFromInput({ recoveryShare: 0.4, year: 2030 })).toBe(ILLUSTRATIVE_STAND);
  });

  it('rng is reproducible', () => {
    const a = rng(9);
    const b = rng(9);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});
