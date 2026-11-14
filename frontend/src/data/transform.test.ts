import { describe, expect, it } from 'vitest';
import { RawRowSchema } from './schema';
import {
  buildCollection,
  buildManifest,
  DuplicatePointError,
  makePointId,
  parseGranuleDate,
  stageFromHeight,
} from './transform';

/** A real row from nisar_ontario.csv (as CSV strings). */
const csvRow = (overrides: Record<string, string> = {}): Record<string, string> => ({
  NDVI: '0.8023668639053254',
  cls: '2',
  elev: '396.5478515625',
  fireYear: '0',
  gediYear: '2021',
  hbin: '1',
  latitude: '50.780527827760885',
  lc2001: '1',
  longitude: '-93.21289943078855',
  lossyear: '0',
  nBurns: '0',
  rain_window_m: '0.0746694505089031',
  rh98: '1.9800000190734863',
  s1_VH: '-15.399787780157467',
  s1_VV: '-10.372903095146672',
  s1_angle: '44.27274703979492',
  slope: '8.825329191773733',
  stratum: '12',
  treecover2000: '85',
  worldcover: '10',
  nisar_HH: '-5.0718371404848375',
  nisar_HV: '-11.51082344502422',
  nisar_granule:
    'NISAR_L2_PR_GCOV_025_148_A_027_4005_DHDH_A_20260718T105945_20260718T110021_P05023_N_F_J_001',
  nisar_HVmHH: '-6.438986304539383',
  s1_VHmVV: '-5.026884685010796',
  site: 'ontario',
  fire_id: 'ontario_ref_203_-373',
  ...overrides,
});

const burnedRow = (overrides: Record<string, string> = {}) =>
  csvRow({ cls: '1', fireYear: '2006', fire_id: 'ontario_2006_203_-373', ...overrides });

const parse = (r: Record<string, string>) => RawRowSchema.parse(r);

describe('RawRowSchema', () => {
  it('accepts a real CSV row and coerces numbers', () => {
    const row = parse(csvRow());
    expect(row.cls).toBe(2);
    expect(row.rh98).toBeCloseTo(1.98, 2);
  });

  it('rejects empty cells instead of coercing them to 0', () => {
    const r = RawRowSchema.safeParse(csvRow({ nisar_HV: '' }));
    expect(r.success).toBe(false);
  });

  it('rejects non-numeric values', () => {
    expect(RawRowSchema.safeParse(csvRow({ rh98: 'NaN' })).success).toBe(false);
    expect(RawRowSchema.safeParse(csvRow({ latitude: 'abc' })).success).toBe(false);
  });

  it('rejects out-of-range values', () => {
    expect(RawRowSchema.safeParse(csvRow({ latitude: '95' })).success).toBe(false);
    expect(RawRowSchema.safeParse(csvRow({ rh98: '40' })).success).toBe(false);
    expect(RawRowSchema.safeParse(csvRow({ cls: '3' })).success).toBe(false);
  });

  it('enforces cls / fireYear consistency', () => {
    expect(RawRowSchema.safeParse(csvRow({ fireYear: '2006' })).success).toBe(false);
    expect(RawRowSchema.safeParse(burnedRow({ fireYear: '0' })).success).toBe(false);
    expect(RawRowSchema.safeParse(burnedRow()).success).toBe(true);
  });

  it('checks derived difference columns', () => {
    expect(RawRowSchema.safeParse(csvRow({ nisar_HVmHH: '-1' })).success).toBe(false);
  });
});

describe('transform', () => {
  it('maps height to stage at the documented breaks', () => {
    expect(stageFromHeight(0)).toBe(0);
    expect(stageFromHeight(4.99)).toBe(0);
    expect(stageFromHeight(5)).toBe(1);
    expect(stageFromHeight(9.99)).toBe(1);
    expect(stageFromHeight(10)).toBe(2);
  });

  it('builds stable IDs from site + coordinates', () => {
    const a = makePointId('ontario', 50.1234567, -93.1);
    expect(a).toMatch(/^ontario-[0-9a-f]{8}$/);
    expect(makePointId('ontario', 50.1234567, -93.1)).toBe(a);
    expect(makePointId('quebec', 50.1234567, -93.1)).not.toBe(a);
  });

  it('parses the acquisition date from the granule name', () => {
    expect(parseGranuleDate(csvRow().nisar_granule!)).toBe('2026-07-18');
    expect(parseGranuleDate('garbage')).toBeNull();
  });

  it('normalizes unburned and burned points', () => {
    const c = buildCollection([parse(csvRow()), parse(burnedRow({ latitude: '50.9' }))]);
    const ref = c.features.find((f) => f.properties.status === 'unburned')!;
    const burned = c.features.find((f) => f.properties.status === 'burned')!;

    expect(ref.geometry.coordinates).toEqual([-93.212899, 50.780528]); // [lon, lat]
    expect(ref.properties.fire_year).toBeNull();
    expect(ref.properties.age_years).toBeNull();
    expect(ref.properties.group_id).toBe('ontario_ref_203_-373');
    expect(ref.properties.lidar_stage).toBe(0);

    expect(burned.properties.fire_year).toBe(2006);
    expect(burned.properties.age_years).toBe(20);
    expect(burned.properties.age_at_gedi_years).toBe(15);
  });

  it('is independent of input row order', () => {
    const rows = [parse(csvRow()), parse(burnedRow({ latitude: '50.9' }))];
    expect(buildCollection(rows)).toEqual(buildCollection([...rows].reverse()));
  });

  it('rejects duplicate points', () => {
    expect(() => buildCollection([parse(csvRow()), parse(csvRow())])).toThrow(DuplicatePointError);
  });

  it('summarizes counts and extent in the manifest', () => {
    const c = buildCollection([
      parse(csvRow()),
      parse(burnedRow({ latitude: '50.9', rh98: '12' })),
    ]);
    const m = buildManifest(c, []);
    expect(m.counts).toEqual({
      points: 2,
      burned: 1,
      unburned: 1,
      burned_groups: 1,
      by_lidar_stage: [1, 0, 1],
    });
    expect(m.fire_years).toEqual([2006]);
    expect(m.bbox).toEqual([-93.212899, 50.780528, -93.212899, 50.9]);
  });
});
