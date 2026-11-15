import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { growHeights, growthSummary, MIN_VISIBLE_HEIGHT, quantileAt } from './growth';
import { createHeightField } from './heightField';
import {
  GROWTH_STAND,
  ILLUSTRATIVE_STAND,
  MATURE_GROWTH,
  REFERENCE_GROWTH,
  cellHeightQuantiles,
  growthFromRecovery,
  standFromInput,
} from './recoveryAdapter';
import { scatterPlants } from './scatter';

const field = createHeightField({ size: 120, seed: GROWTH_STAND.seed % 1000 });
const plants = scatterPlants(field, GROWTH_STAND);
const at = (recoveryShare: number, ageYears: number) =>
  growthSummary(plants, growHeights(plants, growthFromRecovery({ recoveryShare, ageYears })));

describe('forest growth: documented mapping', () => {
  it('draws tree height as the modeled recovery share', () => {
    const half = growthFromRecovery({ recoveryShare: 0.44, ageYears: 23 });
    expect(half.heightScale).toBeCloseTo(0.44, 6);
    expect(growthFromRecovery({ recoveryShare: 1, ageYears: 60 }).heightScale).toBe(1);
    // Slightly above 1 is valid in the model; far above is drawn at 1.15.
    expect(growthFromRecovery({ recoveryShare: 3, ageYears: 60 }).heightScale).toBe(1.15);
    expect(growthFromRecovery({ recoveryShare: -1, ageYears: 1 }).heightScale).toBe(0);
  });

  it('applies the documented illustrative rules', () => {
    const g = growthFromRecovery({ recoveryShare: 0.2, ageYears: 20 });
    expect(g.establishment).toBeCloseTo(0.55, 6);
    expect(g.snagSurvival).toBeCloseTo(Math.exp(-1), 6);
    expect(g.shrubShare).toBeCloseTo(0.85, 6);
    expect(g.pioneerBoost).toBeCloseTo(1.4, 6);
    expect(growthFromRecovery({ recoveryShare: 1, ageYears: 80 }).shrubShare).toBe(0.25);
  });

  it('draws the reference forest before the fire', () => {
    expect(growthFromRecovery({ recoveryShare: 0, ageYears: -1 })).toBe(REFERENCE_GROWTH);
  });

  it('turns a timeline row into height quantiles, ignoring missing cells', () => {
    const q = cellHeightQuantiles([0, null, 50, 100, 140])!;
    expect(q).toHaveLength(21);
    expect(q[0]).toBe(0);
    expect(q.at(-1)).toBe(1.15);
    expect(q).toEqual([...q].sort((a, b) => a - b));
    expect(cellHeightQuantiles([null, null])).toBeNull();
    expect(quantileAt([0, 1], 0.25)).toBeCloseTo(0.25, 6);
  });

  it('scatters the growth stand for a fire and the illustrative stand without one', () => {
    expect(standFromInput({ recoveryShare: 0.4, ageYears: 20 })).toBe(GROWTH_STAND);
    expect(standFromInput(null)).toBe(ILLUSTRATIVE_STAND);
  });
});

describe('forest growth: one stand through the years', () => {
  it('keeps every plant in place and only changes heights', () => {
    const early = growHeights(plants, growthFromRecovery({ recoveryShare: 0.1, ageYears: 3 }));
    const late = growHeights(plants, growthFromRecovery({ recoveryShare: 0.9, ageYears: 60 }));
    expect(early).toHaveLength(plants.length);
    expect(late).toHaveLength(plants.length);
    // A tree present early is still there later, and taller.
    plants.forEach((plant, i) => {
      if (plant.kind === 'snag' || plant.kind === 'shrub' || !early[i]) return;
      expect(late[i]).toBeGreaterThan(early[i]!);
    });
  });

  it('fills in and grows as recovery rises; trunks fall and shrubs recede over time', () => {
    const fire = at(0, 0);
    const young = at(0.3, 10);
    const mature = at(0.95, 60);
    expect(fire.trees).toBe(0);
    expect(young.trees).toBeGreaterThan(fire.trees);
    expect(mature.trees).toBeGreaterThan(young.trees);
    expect(fire.snags).toBeGreaterThan(young.snags);
    expect(young.snags).toBeGreaterThan(mature.snags);
    expect(fire.shrubs).toBeGreaterThan(mature.shrubs);
  });

  it('hides trees below the visible height, and shows the reference forest without dead trunks', () => {
    const tiny = growHeights(plants, growthFromRecovery({ recoveryShare: 0.01, ageYears: 1 }));
    plants.forEach((plant, i) => {
      if (plant.kind !== 'snag' && plant.kind !== 'shrub') expect(tiny[i]).toBe(0);
    });
    const reference = growthSummary(plants, growHeights(plants, REFERENCE_GROWTH));
    expect(reference.snags).toBe(0);
    // Establishment is full from 50% recovery; below it the stand is sparser.
    expect(reference.trees).toBeGreaterThan(at(0.3, 15).trees);
    for (const h of growHeights(plants, REFERENCE_GROWTH))
      if (h) expect(h).toBeGreaterThan(MIN_VISIBLE_HEIGHT);
  });

  it('shows every plant as scattered without data', () => {
    const heights = growHeights(plants, MATURE_GROWTH);
    plants.forEach((plant, i) => expect(heights[i]).toBeCloseTo(plant.height, 5));
  });

  it('gives each plant a fixed rank, so the same trees appear first in every year', () => {
    expect(scatterPlants(field, GROWTH_STAND).map((p) => p.rank)).toEqual(
      plants.map((p) => p.rank),
    );
    for (const p of plants) {
      expect(p.rank).toBeGreaterThanOrEqual(0);
      expect(p.rank).toBeLessThan(1);
      expect(p.heightRank).toBeGreaterThanOrEqual(0);
      expect(p.heightRank).toBeLessThan(1);
    }
  });
});

describe('forest growth: BC 2003 supplied data', () => {
  const folder = resolve(
    import.meta.dirname,
    '../../../public/data/bundle-v2/fire_bc_2003_490/summer_2026',
  );
  const read = (name: string) => JSON.parse(readFileSync(resolve(folder, name), 'utf8'));
  const series = read('result.json').model2.series as { years: number[]; recovery: number[] };
  const timeline = read('timeline.json') as { years: number[]; recovery_pct: (number | null)[][] };

  it('draws 2040 at the supplied whole-fire recovery and the spread of that year’s cells', () => {
    const recovery = series.recovery[series.years.indexOf(2040)]!;
    const row = timeline.recovery_pct[timeline.years.indexOf(2040)]!;
    const g = growthFromRecovery({ recoveryShare: recovery, ageYears: 37, cellRecovery: row });
    expect(g.heightScale).toBeCloseTo(0.6106, 4);
    const sorted = row.filter((v): v is number => v !== null).sort((a, b) => a - b);
    expect(g.heightQuantiles![0]).toBeCloseTo(sorted[0]! / 100, 6);
    expect(g.heightQuantiles![20]).toBeCloseTo(Math.min(1.15, sorted.at(-1)! / 100), 6);
  });
});
