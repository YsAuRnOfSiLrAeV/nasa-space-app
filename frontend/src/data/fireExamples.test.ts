import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BundleIndexSchema, bundleCellIndex, loadBundleV2 } from './bundleV2';
import { StudyDataApi } from '@/services/data/StudyDataApi';
import { curveValue, readForecast } from '@/domain/fire/growthForecast';
import { selectionForFire } from '@/domain/fire/investigationSelection';

const root = resolve(import.meta.dirname, '../../public/data/bundle-v2');
const read = (path: string): unknown => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const index = BundleIndexSchema.parse(read('index.json'));
const examples = [
  ['bc_2003_490', 3154, 0.4436],
  ['quebec_1995_1218', 6533, 0.8382],
  ['quebec_2010_557', 2738, 0.5118],
  ['ontario_1988_21', 3051, 0.8313],
] as const;

describe('four supplied fire examples', () => {
  it('retains all four initial examples in the complete catalog', () => {
    expect(index.fires.map((entry) => entry.id)).toEqual(
      expect.arrayContaining(examples.map(([id]) => id)),
    );
  });

  it.each(examples)(
    '%s uses its own geometry, imagery, observations, timeline and forecast',
    async (id, count, now) => {
      const entry = index.fires.find((entry) => entry.id === id)!;
      const data = await loadBundleV2('', entry, index.summer, async (path) => read(path.slice(1)));
      const bundle = data.bundle!;
      expect(bundle.cells).toHaveLength(count);
      expect(bundle.geometry).toEqual(read(`${entry.dir}/cells.geojson`));
      expect(bundle.timeline).toEqual(read(`${entry.dir}/timeline.json`));
      expect(bundle.timeline!.recovery_pct.every((row) => row.length === count)).toBe(true);
      const first = bundle.cells[0]!;
      expect(bundleCellIndex(bundle, [first.lon, first.lat], data.result.map_grid.columns)).toBe(
        first.row * data.result.map_grid.columns + first.col,
      );
      const gedi = read(`${entry.dir}/gedi.geojson`) as {
        features: { geometry: { coordinates: number[] }; properties: { rh98_m: number } }[];
      };
      expect(data.result.lidar_points).toEqual(
        gedi.features.map(({ geometry, properties }) => ({
          lon: geometry.coordinates[0],
          lat: geometry.coordinates[1],
          height_m: properties.rh98_m,
        })),
      );
      expect(data.opticalImageUrl).toBe(`/${entry.dir}/rgb.png`);
      const png = readFileSync(resolve(root, entry.dir, 'rgb.png'));
      expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([
        bundle.source.image!.width,
        bundle.source.image!.height,
      ]);
      expect(bundle.imageCorners).toEqual(bundle.source.image!.corners_lonlat);
      const forecast = readForecast(data.result, bundle.source.model2);
      expect(forecast.status).toBe('valid');
      if (forecast.status !== 'valid') throw new Error('Expected supplied forecast');
      expect(curveValue(forecast.curve, 2026)).toBe(now);
      expect(forecast.curve.series).toEqual(bundle.source.model2.series);
      expect(data.result.model_result.recovery_today_avg).toBeNull();
    },
  );

  it('switches through the shared service and resets inspection and both year controls, including on return', async () => {
    const api = new StudyDataApi({
      baseUrl: '/data',
      bundleBaseUrl: '/bundle',
      fetch: (async (url) => {
        const path = String(url);
        const folder = path.startsWith('/bundle/') ? root : resolve(root, '..');
        return new Response(
          readFileSync(resolve(folder, path.replace(/^\/(bundle|data)\//, '')), 'utf8'),
        );
      }) as typeof fetch,
    });
    await api.loadFireIndex();
    let selection = {
      fireId: 'bc_2003_490' as string | null,
      cell: 812 as number | null,
      year: 2066 as number | null,
      timelineYear: 2066 as number | null,
    };
    for (const id of [...examples.slice(1).map(([id]) => id), 'bc_2003_490']) {
      selection = selectionForFire(selection, id);
      expect(selection).toEqual({ fireId: id, cell: null, year: null, timelineYear: null });
      const data = (await api.loadFire(id))!;
      expect(data.result.fire.id).toBe(id);
      expect(data.bundle!.cells).toHaveLength(examples.find(([key]) => key === id)![1]);
      expect(data.opticalImageUrl).toContain(`fire_${id}/`);
      selection = { fireId: id, cell: 0, year: 2040, timelineYear: 2040 };
    }
  });

  it.each(examples)(
    '%s tolerates absent optional resources without borrowing another fire data',
    async (id) => {
      const entry = index.fires.find((entry) => entry.id === id)!;
      const files = ['manifest.json', 'result.json', 'polygon.geojson'];
      const data = await loadBundleV2('', { ...entry, files }, index.summer, async (path) => {
        const value = read(path.slice(1));
        return path.endsWith('manifest.json') ? { ...(value as object), files } : value;
      });
      expect(data.bundle!.cells).toEqual([]);
      expect(data.bundle!.geometry.features).toEqual([]);
      expect(data.bundle!.timeline).toBeNull();
      expect(data.result.lidar_points).toEqual([]);
      expect(data.opticalImageUrl).toBeNull();
      expect(data.result.fire.id).toBe(id);
    },
  );
});
