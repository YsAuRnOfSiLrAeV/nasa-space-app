import { describe, expect, it } from 'vitest';
import {
  clearShare,
  isClear,
  isSlcOff,
  ndviDomain,
  ndviFromSample,
  reflectance,
  summariseNdvi,
  type Sample,
} from './landsat';

/** DN for a target reflectance (inverse of the C2 L2 scale and offset). */
const dn = (r: number) => (r + 0.2) / 0.0000275;
const CLEAR = 21824; // a real clear-land QA_PIXEL value (bits 0–5 all zero)

describe('Landsat C2 L2 sample handling', () => {
  it('applies the Collection 2 scale and offset', () => {
    expect(reflectance(dn(0.05))).toBeCloseTo(0.05, 10);
  });

  it('rejects fill, cloud, cirrus, shadow and snow', () => {
    expect(isClear(CLEAR)).toBe(true);
    for (const bit of [0, 1, 2, 3, 4, 5])
      expect(isClear(CLEAR | (1 << bit)), `bit ${bit}`).toBe(false);
    // The cloud-shadow pixel sampled from LE07_L2SP_029024_20000817_02_T1 during the audit.
    expect(isClear(7440)).toBe(false);
  });

  it('computes NDVI from reflectance, not raw DNs', () => {
    expect(ndviFromSample(dn(0.04), dn(0.36), CLEAR)).toBeCloseTo(0.8, 10);
    expect(ndviFromSample(dn(0.04), dn(0.36), 7440)).toBeNull();
    expect(ndviFromSample(0, 0, 1)).toBeNull();
  });

  it('flags Landsat 7 scan-line-corrector-off scenes only', () => {
    expect(isSlcOff({ id: 'a', date: '2003-06-01', platform: 'landsat-7' })).toBe(true);
    expect(isSlcOff({ id: 'b', date: '2001-08-01', platform: 'landsat-7' })).toBe(false);
    expect(isSlcOff({ id: 'c', date: '2010-08-01', platform: 'landsat-5' })).toBe(false);
  });
});

describe('NDVI summaries', () => {
  const scenes = [
    { id: 's1', date: '2001-07-10', platform: 'landsat-7' },
    { id: 's2', date: '2001-08-11', platform: 'landsat-5' },
    { id: 's3', date: '2003-07-20', platform: 'landsat-5' },
  ];
  const ok = (r: number, n: number): Sample => [dn(r), dn(n), CLEAR];
  const cloud: Sample = [dn(0.3), dn(0.35), CLEAR | 8];
  const samples: Record<string, Sample> = {
    's1|a': ok(0.04, 0.36), // 0.8
    's2|a': ok(0.05, 0.45), // 0.8
    's1|b': ok(0.1, 0.3), // 0.5
    's2|b': cloud,
    's1|r': ok(0.03, 0.27), // 0.8
    's3|a': cloud,
    's3|b': cloud,
  };

  const rows = summariseNdvi(scenes, samples, ['a', 'b'], ['r'], [2001, 2003]);

  it('takes each point’s median, then the median over points', () => {
    expect(rows[0]!.burned).toEqual({ median: 0.65, n_points: 2, n_obs: 3 });
    expect(rows[0]!.reference).toEqual({ median: 0.8, n_points: 1, n_obs: 1 });
    expect(rows[0]!.platforms).toEqual(['landsat-5', 'landsat-7']);
  });

  it('leaves years without a clear observation empty instead of filling them', () => {
    expect(rows.map((r) => r.year)).toEqual([2001, 2002, 2003]);
    expect(rows[1]).toEqual({ year: 2002, platforms: [], burned: null, reference: null });
    expect(rows[2]!.burned).toBeNull();
  });

  it('measures how clear a scene is at the given points', () => {
    expect(clearShare('s2', ['a', 'b'], samples)).toBe(0.5);
    expect(clearShare('s3', ['a', 'b', 'missing'], samples)).toBe(0);
  });
});

describe('NDVI axis range', () => {
  const year = (y: number, burned: number | null, reference: number | null) => ({
    year: y,
    burned: burned === null ? null : { median: burned, n_points: 1, n_obs: 1 },
    reference: reference === null ? null : { median: reference, n_points: 1, n_obs: 1 },
    platforms: [],
  });

  it('keeps at least 0.2 to 0.9, so a calm record is not stretched', () => {
    expect(ndviDomain([year(2001, 0.7, 0.75), year(2002, null, 0.8)])).toEqual([0.2, 0.9]);
  });

  it('widens to fit any value outside that range, from either series', () => {
    expect(ndviDomain([year(2001, 0.1, 0.95)])).toEqual([0.1, 0.95]);
  });
});
