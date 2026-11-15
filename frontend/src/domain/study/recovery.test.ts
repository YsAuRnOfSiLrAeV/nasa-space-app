import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { median } from 'd3-array';
import { describe, expect, it } from 'vitest';
import type { RecoveryFile } from '@/data/recoverySchema';
import type { Manifest, PointCollection } from '@/data/schema';
import { buildStudyView } from './studyView';
import {
  RECOVERY_METRICS,
  chronosequence,
  groupRecovery,
  observationTimeline,
  observationsForYear,
  observedYears,
  ndviRecovery,
} from './recovery';

const ROOT = resolve(import.meta.dirname, '../../..');
const json = <T>(p: string) => JSON.parse(readFileSync(resolve(ROOT, p), 'utf8')) as T;
const study = buildStudyView({
  manifest: json<Manifest>('public/data/manifest.json'),
  points: json<PointCollection>('public/data/points.geojson'),
});

describe('group recovery summary', () => {
  it('uses exactly the group’s burned points and agrees with the register', () => {
    for (const g of study.burnGroups) {
      const r = groupRecovery(g, study.located);
      expect(r.points).toHaveLength(g.count);
      expect(r.points.every((p) => p.group_id === g.id && p.status === 'burned')).toBe(true);
      expect(r.preFireClasses.reduce((s, c) => s + c.n, 0)).toBe(g.count);
      expect(r.ageAtGedi[0]).toBeLessThanOrEqual(r.ageAtGedi[1]);
    }
  });

  it('matches the Phase 0 audit for group 2002_205_-376', () => {
    const g = study.burnGroups.find((x) => x.id === '2002_205_-376')!;
    const r = groupRecovery(g, study.located);
    expect(r.gediYears).toEqual([2019, 2020, 2022]);
    expect(r.preFireClasses.map((c) => [c.code, c.n])).toEqual([
      [1, 28],
      [8, 2],
    ]);
    expect(r.preFireClasses[0]!.label).toBe('Evergreen needleleaf forest');
    expect(r.treeCover2000Pct).toBe(83.5);
  });
});

describe('observation timeline', () => {
  const g = study.burnGroups[0]!;
  const lanes = observationTimeline(groupRecovery(g, study.located), study.manifest);

  it('shows only observed years, with an explicit empty imagery lane', () => {
    const imagery = lanes.find((l) => l.id === 'imagery')!;
    expect(imagery.events).toEqual([]);
    expect(imagery.empty).toMatch(/No imagery/);
    expect(lanes.find((l) => l.id === 'fire')!.events.map((e) => e.year)).toEqual([g.fireYear]);
  });

  it('fills the imagery and NDVI-history lanes only from a fetched Landsat file', () => {
    const history = lanes.find((l) => l.id === 'landsat-ndvi')!;
    expect(history.events).toEqual([]);
    expect(history.empty).toMatch(/Not loaded/);
    const landsat = {
      images: [
        {
          scene_id: 's',
          date: '2001-08-02',
          platform: 'landsat-7',
          clear_share: 0.97,
          natural: 'n',
          swir: 's',
        },
      ],
      ndvi: [
        {
          year: 2001,
          platforms: ['landsat-7'],
          burned: { median: 0.81, n_points: 28, n_obs: 60 },
          reference: null,
        },
        { year: 2002, platforms: [], burned: null, reference: null },
      ],
    } as unknown as RecoveryFile;
    const withData = observationTimeline(groupRecovery(g, study.located), study.manifest, landsat);
    expect(withData.find((l) => l.id === 'imagery')!.events).toEqual([
      { year: 2001, label: '2001-08-02, Landsat 7, 97% of points clear' },
    ]);
    // The year without a clear observation is absent, not interpolated.
    expect(withData.find((l) => l.id === 'landsat-ndvi')!.events.map((e) => e.year)).toEqual([
      2001,
    ]);
  });

  it('counts every GEDI footprint once', () => {
    const gedi = lanes.find((l) => l.id === 'gedi')!;
    const total = gedi.events.reduce((s, e) => s + Number(e.label.split(' ')[0]), 0);
    expect(total).toBe(g.count);
  });
});

describe('observations for one calendar year', () => {
  const g = study.burnGroups.find((x) => x.id === '2002_205_-376')!;
  const r = groupRecovery(g, study.located);
  const ref = study.manifest.reference_year;
  const landsat = {
    images: [
      {
        scene_id: 's',
        date: '2001-08-02',
        platform: 'landsat-7',
        clear_share: 0.97,
        natural: 'n.jpg',
        swir: 's.jpg',
      },
    ],
    ndvi: [
      {
        year: 2001,
        platforms: ['landsat-7'],
        burned: { median: 0.81, n_points: 28, n_obs: 60 },
        reference: { median: 0.79, n_points: 12, n_obs: 30 },
      },
      { year: 2003, platforms: [], burned: null, reference: null },
    ],
  } as unknown as RecoveryFile;
  const obs = (year: number, file: RecoveryFile | null = null) =>
    observationsForYear(r, file, year, ref);
  const row = (year: number, source: string, file: RecoveryFile | null = null) =>
    obs(year, file).rows.find((x) => x.source.startsWith(source));

  it('reports nothing after the reference year', () => {
    for (const y of [ref + 1, ref + 10]) {
      expect(obs(y, landsat)).toEqual({ calendarYear: y, future: true, rows: [], image: null });
    }
  });

  it('never claims a measurement without data, across every illustrated year', () => {
    const gedi = new Set(r.gediYears);
    for (let y = g.fireYear; y <= ref; y++) {
      const measured = obs(y)
        .rows.filter((x) => x.measured)
        .map((x) => x.source);
      const expected = [
        ...(y === g.fireYear ? ['MODIS MCD64A1'] : []),
        ...(gedi.has(y) ? ['GEDI L2A lidar'] : []),
        ...(y === ref ? ['NISAR · Sentinel-1 · Sentinel-2'] : []),
      ];
      expect(measured, String(y)).toEqual(expected);
    }
  });

  it('says why GEDI is missing: before launch, or no footprint that year', () => {
    expect(row(2010, 'GEDI')).toMatchObject({ measured: false, text: /not yet in orbit/ });
    expect(row(2021, 'GEDI')).toMatchObject({ measured: false, text: /No footprint/ });
  });

  it('reports the GEDI footprints of that year with their own median', () => {
    const shots = r.points.filter((p) => p.gedi_year === 2019);
    const m = median(shots, (p) => p.rh98_m)!;
    expect(row(2019, 'GEDI')).toEqual({
      source: 'GEDI L2A lidar',
      text: `${shots.length} footprints measured a median canopy height of ${m.toFixed(1)} m.`,
      measured: true,
    });
  });

  it('reads Landsat NDVI from the file and leaves unclear years empty', () => {
    const pre = observationsForYear(r, landsat, 2001, ref);
    expect(pre.rows.find((x) => x.source.startsWith('Landsat NDVI'))).toEqual({
      source: 'Landsat NDVI, Landsat 7',
      text: 'Summer greenness 0.81 at 28 points; unburned forest nearby 0.79.',
      measured: true,
    });
    expect(pre.image?.natural).toBe('n.jpg');
    expect(row(2003, 'Landsat NDVI', landsat)).toMatchObject({
      measured: false,
      text: 'No clear summer observation this year.',
    });
    expect(row(2003, 'Landsat NDVI')).toMatchObject({
      measured: false,
      text: 'Not fetched for this group.',
    });
    expect(obs(2003, landsat).image).toBeNull();
  });

  it('lists observed years only where a value exists', () => {
    expect(observedYears(r, landsat)).toEqual({ ndvi: [2001], gedi: r.gediYears });
    expect(observedYears(r, null).ndvi).toEqual([]);
  });
});

describe('greenness recovery headline', () => {
  const row = (year: number, burned: number | null, reference: number | null) => ({
    year,
    platforms: [],
    burned: burned === null ? null : { median: burned, n_points: 3, n_obs: 3 },
    reference: reference === null ? null : { median: reference, n_points: 3, n_obs: 3 },
  });
  const file = (rows: ReturnType<typeof row>[]) =>
    ({ fire_year: 2002, ndvi: rows }) as unknown as RecoveryFile;

  it('reads the fetched group: 0.73 before, 0.34 in 2003, back beside unburned forest in 2013', () => {
    const f = json<RecoveryFile>('public/data/recovery/2002_205_-376.json');
    const r = ndviRecovery(f)!;
    expect(r.before.toFixed(2)).toBe('0.73');
    expect([r.low.toFixed(2), r.lowYear]).toEqual(['0.34', 2003]);
    expect(r.backYear).toBe(2013);
    expect(r.lastYear).toBe(2026);
  });

  it('measures "back" against the pre-fire difference, not equality', () => {
    // Burned was always 0.05 below its neighbours; 0.04 below counts as back.
    const r = ndviRecovery(
      file([
        row(2000, 0.7, 0.75),
        row(2003, 0.3, 0.75),
        row(2005, 0.6, 0.75),
        row(2008, 0.71, 0.75),
      ]),
    )!;
    expect(r.preFireGap).toBeCloseTo(-0.05);
    expect(r.backYear).toBe(2008);
  });

  it('says not yet when the gap never closes, and ignores years missing either value', () => {
    const r = ndviRecovery(
      file([row(2000, 0.7, 0.7), row(2003, 0.3, 0.7), row(2004, 0.75, null), row(2006, 0.5, 0.7)]),
    )!;
    expect(r.backYear).toBeNull();
    expect(r.lastYear).toBe(2006);
  });

  it('has no headline without both a pre-fire and a post-fire observation', () => {
    expect(ndviRecovery(file([row(2003, 0.3, 0.7)]))).toBeNull();
    expect(ndviRecovery(file([row(2000, 0.7, 0.7), row(2003, 0.3, null)]))).toBeNull();
  });
});

describe('chronosequence', () => {
  it.each(RECOVERY_METRICS.map((m) => m.key))(
    '%s: one column per group, youngest first, then the reference',
    (key) => {
      const cols = chronosequence(study.located, study.burnGroups, key);
      expect(cols).toHaveLength(study.burnGroups.length + 1);
      expect(cols.at(-1)!.id).toBe('reference');
      expect(cols.at(-1)!.values).toHaveLength(study.manifest.counts.unburned);
      const ages = cols.slice(0, -1).map((c) => c.ageYears!);
      expect(ages).toEqual([...ages].sort((a, b) => a - b));
      expect(cols.reduce((s, c) => s + c.values.length, 0)).toBe(study.manifest.counts.points);
    },
  );
});
