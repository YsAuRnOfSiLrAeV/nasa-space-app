import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PointCollectionSchema } from '../data/schema';
import { averageRanks, pearson, spearman } from './stats';

describe('stats', () => {
  it('pearson handles perfect and degenerate cases', () => {
    expect(pearson([1, 2, 3], [2, 4, 6])).toBeCloseTo(1);
    expect(pearson([1, 2, 3], [3, 2, 1])).toBeCloseTo(-1);
    expect(pearson([1, 1, 1], [1, 2, 3])).toBeNaN();
    expect(pearson([1], [1])).toBeNaN();
  });

  it('averages tied ranks', () => {
    expect(averageRanks([10, 20, 20, 30])).toEqual([1, 2.5, 2.5, 4]);
  });

  it('spearman is rank-based (monotone, non-linear → 1)', () => {
    expect(spearman([1, 2, 3, 4], [1, 8, 27, 64])).toBeCloseTo(1);
  });

  it('reproduces the correlations reported in SPACEAPPS_CONTEXT.md on the real data', () => {
    const geojson = JSON.parse(
      readFileSync(resolve(import.meta.dirname, '../../public/data/points.geojson'), 'utf8'),
    );
    const props = PointCollectionSchema.parse(geojson).features.map((f) => f.properties);
    const h = props.map((p) => p.rh98_m);
    const rho = (key: 'nisar_hv_db' | 'nisar_hh_db' | 's1_vv_db' | 's1_vh_db' | 'ndvi') =>
      Math.round(
        spearman(
          h,
          props.map((p) => p[key]),
        ) * 100,
      ) / 100;

    expect(rho('nisar_hv_db')).toBe(0.44);
    expect(rho('nisar_hh_db')).toBe(0.34);
    expect(rho('s1_vv_db')).toBe(0.26);
    expect(rho('s1_vh_db')).toBe(0.17);
    expect(rho('ndvi')).toBe(0.31);
  });
});
