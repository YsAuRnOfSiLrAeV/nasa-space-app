import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  BundleIndexSchema,
  loadBundleV2,
  SeriesSchema,
  TimelineSchema,
  bundleCellIndex,
} from '@/data/bundleV2';
import { readForecast, curveValue } from '@/domain/fire/growthForecast';
import { ForecastChart } from '@/components/fire/ForecastChart';
import { pickGridTarget } from '@/domain/fire/gridPicking';
import { StudyDataApi } from '@/services/data/StudyDataApi';
const root = resolve(import.meta.dirname, '../../../public/data/bundle-v2');
const file = (path: string): unknown => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const index = BundleIndexSchema.parse(file('index.json'));
const entry = index.fires.find((fire) => fire.id === 'bc_2003_490')!;
async function load(overrides: Record<string, unknown> = {}, omitted: string[] = []) {
  const files = entry.files.filter((name) => !omitted.includes(name));
  return loadBundleV2('/bundle', { ...entry, files }, index.summer, async (url) => {
    const path = url.replace('/bundle/', '');
    if (path in overrides) return overrides[path];
    const data = file(path);
    return path.endsWith('manifest.json') ? { ...(data as object), files } : data;
  });
}
describe('BC 2003 supplied bundle v2', () => {
  it('loads through the existing investigation service and replaces the legacy example cards', async () => {
    const api = new StudyDataApi({
      baseUrl: '/data',
      bundleBaseUrl: '/bundle',
      fetch: (async (url) => {
        const path = String(url);
        const folder = path.startsWith('/bundle/') ? root : resolve(root, '..');
        const relative = path.replace(/^\/(bundle|data)\//, '');
        return new Response(readFileSync(resolve(folder, relative), 'utf8'), {
          headers: { 'content-type': 'application/json' },
        });
      }) as typeof fetch,
    });
    const catalog = await api.loadFireIndex();
    expect(catalog.filter((fire) => fire.id === 'bc_2003_490')).toHaveLength(1);
    expect(catalog).toHaveLength(80);
    expect(catalog.map((fire) => fire.id)).toEqual(index.fires.map((fire) => fire.id));
    expect((await api.loadFire('bc_2003_490'))?.bundle?.cells).toHaveLength(3154);
  });
  it('validates the actual BC source assets', async () => {
    const data = await load();
    expect(data.bundle?.cells).toHaveLength(3154);
    expect(data.bundle?.source.model1?.mean).toBe(0.708);
    expect(data.result.model_result.recovery_today_avg).toBeNull();
    expect(data.bundle?.source.model2.now_recovery).toBe(0.4436);
    expect(data.result.warnings).toContain('FORECAST_EXTRAPOLATES_BEYOND_AGE_36');
  });
  it('preserves cell polygons, identifiers and score units', async () => {
    const data = await load();
    const original = file(`${entry.dir}/cells.geojson`) as {
      features: { geometry: unknown; properties: { i: number } }[];
    };
    expect(data.bundle!.geometry.features[0]!.geometry).toEqual(original.features[0]!.geometry);
    expect(data.bundle!.geometry.features[0]!.properties!.i).toBe(
      original.features[0]!.properties.i,
    );
    const cell = data.bundle!.cells[0]!;
    expect(data.cells.model.p_forest_gt5[cell.row * data.result.map_grid.columns + cell.col]).toBe(
      cell.p_forest_gt5! * 100,
    );
    expect(data.cells.model.stage.every((value) => value === null)).toBe(true);
    expect(bundleCellIndex(data.bundle!, [cell.lon, cell.lat], data.result.map_grid.columns)).toBe(
      cell.row * data.result.map_grid.columns + cell.col,
    );
    expect(bundleCellIndex(data.bundle!, [0, 0], data.result.map_grid.columns)).toBeNull();
  });
  it('uses rotated image corners and measured GEDI coordinates without reprojection', async () => {
    const data = await load();
    expect(data.opticalImageUrl).toBe(`/bundle/${entry.dir}/rgb.png`);
    expect(data.bundle!.imageCorners![0]).toEqual([-120.52404, 51.22497]);
    expect(data.bundle!.imageCorners![1]![1]).not.toBe(data.bundle!.imageCorners![0]![1]);
    expect(data.result.lidar_points[0]).toEqual({ lon: -120.29172, lat: 51.25215, height_m: 3.9 });
    expect(pickGridTarget(data, 'probability', null, 0)?.kind).toBe('gedi');
    const png = readFileSync(resolve(root, entry.dir, 'rgb.png'));
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([367, 394]);
  });
  it('reads the supplied forecast and interval, independently from the cell timeline', async () => {
    const data = await load();
    const forecast = readForecast(data.result, data.bundle!.source.model2);
    expect(forecast.status).toBe('valid');
    if (forecast.status !== 'valid') return;
    expect(forecast.curve.tau).toBeUndefined();
    expect(curveValue(forecast.curve, 2026)).toBe(0.4436);
    const chart = renderToStaticMarkup(
      createElement(ForecastChart, { curve: forecast.curve, observed: null, year: 2026 }),
    );
    expect(chart).toContain('data-forecast-interval="80"');
    const source = data.bundle!.source.model2.series!;
    const yearIndex = source.years.indexOf(2026);
    expect([source.low[yearIndex], source.high[yearIndex]]).toEqual([0.2712, 0.6161]);
    const timeline = data.bundle!.timeline!;
    expect(timeline.recovery_pct[0]).toHaveLength(data.bundle!.cells.length);
    expect(timeline.recovery_pct[timeline.years.indexOf(2026)]).toHaveLength(3154);
    expect(timeline.recovery_pct[0]).not.toEqual(timeline.recovery_pct.at(-1));
  });
  it('supports absent optional cells, imagery, GEDI and timeline without invented data', async () => {
    const data = await load({}, [
      'cells.json',
      'cells.geojson',
      'gedi.geojson',
      'rgb.png',
      'timeline.json',
    ]);
    expect(data.bundle!.geometry.features).toEqual([]);
    expect(data.bundle!.timeline).toBeNull();
    expect(data.opticalImageUrl).toBeNull();
    expect(data.result.lidar_points).toEqual([]);
    expect(data.cells.model.p_forest_gt5).toEqual([null]);
  });
  it('rejects mismatched manifests, missing declared files and mismatched cell identities', async () => {
    await expect(load({ [`${entry.dir}/manifest.json`]: {} })).rejects.toThrow();
    await expect(load({ [`${entry.dir}/cells.json`]: {} })).rejects.toThrow();
    await expect(load({}, ['cells.geojson'])).rejects.toThrow('together');
    await expect(
      loadBundleV2('/bundle', entry, 2026, async () => {
        throw new Error('missing');
      }),
    ).rejects.toThrow('missing');
  });
  it('rejects malformed forecast bounds and timeline indexing', () => {
    expect(
      SeriesSchema.safeParse({ years: [2026], recovery: [0.4], low: [0.6], high: [0.8] }).success,
    ).toBe(false);
    expect(
      TimelineSchema.safeParse({ years: [2026], cells: 2, ref_height_m: 19, recovery_pct: [[20]] })
        .success,
    ).toBe(false);
  });
});
