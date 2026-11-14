import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FireCellsSchema, FireResultSchema, type FireData } from '@/data/fireSchema';
import {
  canPreview,
  forecastEndYear,
  outsideReliableAge,
  previewFire,
  previewRecovery,
} from './fireForecast';

const dir = new URL('../../../public/data/demo/bc_2003_490/', import.meta.url);
function fixture(): FireData {
  return {
    result: FireResultSchema.parse(JSON.parse(readFileSync(new URL('result.json', dir), 'utf8'))),
    cells: FireCellsSchema.parse(JSON.parse(readFileSync(new URL('cells.json', dir), 'utf8'))),
    opticalImageUrl: null,
  };
}

describe('explicit forward-growth preview', () => {
  it('starts at the supplied value, grows towards the reference and never backcasts', () => {
    expect(previewRecovery(0.36, 0, 25.2)).toBeCloseTo(0.36);
    expect(previewRecovery(0.36, 25.2, 25.2)).toBeCloseTo(1 - 0.64 / Math.E);
    expect(previewRecovery(0.36, 1000, 25.2)).toBeCloseTo(1);
    expect(previewRecovery(0, 10, 25.2)).toBeGreaterThan(0);
    expect(previewRecovery(1.2, 10, 25.2)).toBe(1.2);
    expect(previewRecovery(null, 10, 25.2)).toBeNull();
    expect(previewRecovery(0.36, -1, 25.2)).toBeNull();
    expect(previewRecovery(0.36, 1, 0)).toBeNull();
  });

  it('uses current cells unchanged at the observation year and does not mutate the export', () => {
    const data = fixture();
    const source = structuredClone(data);
    expect(previewFire(data, 2026)).toBe(data);
    previewFire(data, 2044);
    expect(data).toEqual(source);
  });

  it('projects only eligible burned cells, preserving reference and missing values', () => {
    const data = fixture();
    data.cells.map.zone[1] = 0;
    data.cells.map.confidence[2] = 1;
    data.cells.map.zone[2] = 1;
    data.cells.map.zone[3] = 1;
    data.cells.map.confidence[3] = 2;
    data.cells.map.zone[4] = 1;
    data.cells.map.confidence[4] = 2;
    data.cells.map.reburn_year[4] = 2030;
    const future = previewFire(data, 2044);
    expect(future.cells.model.recovery[1]).toBe(97);
    expect(future.cells.model.recovery[2]).toBeNull();
    expect(future.cells.model.recovery[3]).toBeGreaterThan(58);
    expect(future.cells.model.recovery[4]).toBeNull();
    expect(future.cells.model.recovery[5]).toBeNull();
    expect(future.cells.model.stage.every((v) => v === null)).toBe(true);
    expect(future.cells.model.p_forest_gt5.every((v) => v === null)).toBe(true);
    expect(future.cells.optics.ndvi.every((v) => v === null)).toBe(true);
    expect(future.result.lidar_points).toBe(data.result.lidar_points);
  });

  it('does not guess an equation for missing or unsupported forecast methods', () => {
    const data = fixture();
    data.result.growth_forecast = null;
    expect(canPreview(data.result)).toBe(false);
    expect(previewFire(data, 2040).cells.model.recovery[3]).toBeNull();
    data.result.growth_forecast = {
      method: 'unknown',
      tau: 25,
      reliable_age: [9, 35],
      year_80pct: null,
      years_to_80pct: null,
    };
    expect(canPreview(data.result)).toBe(false);
  });

  it('flags extrapolation by fire age and retains the separately supplied milestone', () => {
    const data = fixture();
    expect(outsideReliableAge(data.result, 2026)).toBe(false);
    expect(outsideReliableAge(data.result, 2038)).toBe(false);
    expect(outsideReliableAge(data.result, 2039)).toBe(true);
    expect(forecastEndYear(data.result)).toBeGreaterThanOrEqual(2044);
    expect(previewRecovery(0.36, 2044 - 2026, 25.2)).not.toBeCloseTo(0.8, 2);
    expect(previewFire(data, 2044).result.growth_forecast?.year_80pct).toBe(2044);
  });
});
