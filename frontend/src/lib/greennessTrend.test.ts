import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { greennessTrend } from './greennessTrend';
import { RecoveryFileSchema, type NdviYear } from '../data/recoverySchema';

const summary = (median: number) => ({ median, n_points: 5, n_obs: 10 });
const row = (year: number, burned: number | null, reference: number | null): NdviYear => ({
  year,
  platforms: [],
  burned: burned === null ? null : summary(burned),
  reference: reference === null ? null : summary(reference),
});

describe('paired post-fire greenness trend', () => {
  it('fits actual years, excludes the fire year, and removes shared reference changes', () => {
    const rows = [
      row(2000, 1, 0),
      row(2002, 0, 1),
      row(2003, 0.3, 0.5),
      row(2005, 0.5, 0.6),
      row(2008, 0.75, 0.7),
    ];
    const trend = greennessTrend(rows, 2002)!;
    expect(trend.n).toBe(3);
    expect(trend.slope).toBeCloseTo(0.05);
    expect(trend.missing).toBe(3);
    expect(trend.residualLag1).toBeNull();
  });

  it('excludes unpaired years without inserting zero and handles short records', () => {
    expect(
      greennessTrend([row(2003, 0.1, 0.5), row(2004, null, 0.6), row(2005, 0.3, null)], 2002),
    ).toBeNull();
    const trend = greennessTrend(
      [row(2003, 0, 0.5), row(2004, 0.1, 0.5), row(2006, 0.3, 0.5)],
      2002,
    )!;
    expect(trend.slope).toBeCloseTo(0.1);
    expect(trend.missing).toBe(1);
  });

  it('produces an uncertainty interval for noisy records and is invariant to input ordering', () => {
    const rows = Array.from({ length: 15 }, (_, index) =>
      row(2003 + index, 0.3 + index * 0.01 + Math.sin(index) * 0.03, 0.7),
    );
    const trend = greennessTrend(rows, 2002)!;
    expect(trend.interval[0]).toBeLessThan(trend.slope);
    expect(trend.interval[1]).toBeGreaterThan(trend.slope);
    expect(greennessTrend([...rows].reverse(), 2002)).toEqual(trend);
    expect(() => greennessTrend([...rows, rows[0]!], 2002)).toThrow('duplicate years');
  });

  it('computes finite evidence from the shipped Landsat record', () => {
    const file = RecoveryFileSchema.parse(
      JSON.parse(
        readFileSync(
          resolve(import.meta.dirname, '../../public/data/recovery/2002_205_-376.json'),
          'utf8',
        ),
      ),
    );
    const trend = greennessTrend(file.ndvi, file.fire_year)!;
    expect(trend.n).toBeGreaterThan(10);
    expect(trend.from).toBeGreaterThan(file.fire_year);
    expect(trend.interval.every(Number.isFinite)).toBe(true);
  });
});
