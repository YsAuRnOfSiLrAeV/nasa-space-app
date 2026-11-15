import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BundleIndexSchema, bundleIndexEntry } from '@/data/bundleV2';
import { CatalogPerimetersSchema } from '@/data/catalogPerimeters';
import { StudyDataApi } from '@/services/data/StudyDataApi';
import { filterFireCatalog } from '@/domain/fire/catalogSearch';
import { mapHref, mapStateOf, parseRoute } from '@/app/route';
import { BundleAvailability } from '@/components/fire/BundleAvailability';
import { FireCatalogList } from '@/compositions/earth-intelligence/FireCatalogList';

const root = resolve(import.meta.dirname, '../../../public/data/bundle-v2');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const index = BundleIndexSchema.parse(JSON.parse(read('index.json')));
function service(limit = 3) {
  const requests: string[] = [];
  const api = new StudyDataApi({
    baseUrl: '/data',
    bundleBaseUrl: '/bundle',
    maxCachedFires: limit,
    fetch: (async (input) => {
      const url = String(input);
      requests.push(url);
      const folder = url.startsWith('/bundle/') ? root : resolve(root, '..');
      return new Response(
        readFileSync(resolve(folder, url.replace(/^\/(bundle|data)\//, '')), 'utf8'),
      );
    }) as typeof fetch,
  });
  return { api, requests };
}

describe('complete supplied fire catalog', () => {
  it('lists 80 fires and their capabilities without requesting individual exports', async () => {
    const { api, requests } = service();
    const catalog = await api.loadFireIndex();
    expect(catalog).toHaveLength(80);
    expect(new Set(catalog.map((fire) => fire.id)).size).toBe(80);
    expect(catalog.filter((fire) => fire.capabilities!.spatial)).toHaveLength(37);
    expect(catalog.filter((fire) => fire.capabilities!.timeline)).toHaveLength(18);
    expect(requests).toEqual(['/data/demo/index.json', '/bundle/index.json']);
    const html = renderToStaticMarkup(
      <FireCatalogList
        catalog={{ state: { status: 'ready', data: catalog }, retry: () => {} }}
        selectedId={null}
        onSelect={() => {}}
      />,
    );
    expect(html.match(/Spatial data available/g)).toHaveLength(37);
    expect(html.match(/Perimeter and summary only/g)).toHaveLength(43);
    expect(html.match(/Timeline available/g)).toHaveLength(18);
    expect(html.match(/Forecast available/g)).toHaveLength(
      catalog.filter((fire) => fire.capabilities!.forecast).length,
    );
    expect(html).toContain('Search identifier, year or region');
  });

  it('uses every original perimeter and identifier in the lightweight collection', async () => {
    const { api, requests } = service();
    const collection = CatalogPerimetersSchema.parse(await api.loadFirePerimeters());
    expect(collection.features).toHaveLength(80);
    for (const entry of index.fires) {
      const source = JSON.parse(read(`${entry.dir}/polygon.geojson`)) as { geometry: unknown };
      expect(
        collection.features.find((feature) => feature.properties.id === entry.id)!.geometry,
      ).toEqual(source.geometry);
    }
    expect(requests).toEqual(['/bundle/perimeters.geojson']);
  });

  it.each([0, 20, 40, 60])(
    'selects the 20-fire batch starting at %i lazily, including spatial and summary-only states',
    async (startIndex) => {
      const { api, requests } = service();
      const catalog = await api.loadFireIndex();
      for (const entry of catalog.slice(startIndex, startIndex + 20)) {
        const start = requests.length;
        const data = (await api.loadFire(entry.id))!;
        expect(data.result.fire.id).toBe(entry.id);
        expect(data.result.fire.perimeter).not.toBeNull();
        const sourceEntry = index.fires.find((source) => source.id === entry.id)!;
        expect(
          requests.slice(start).every((url) => url.startsWith(`/bundle/${sourceEntry.dir}/`)),
        ).toBe(true);
        expect(data.bundle!.cells.length > 0).toBe(entry.capabilities!.spatial);
        expect(data.bundle!.geometry.features.length).toBe(data.bundle!.cells.length);
        expect(Boolean(data.opticalImageUrl)).toBe(entry.capabilities!.imagery);
        expect(Boolean(data.bundle!.timeline)).toBe(entry.capabilities!.timeline);
        expect(data.bundle!.capabilities.forecast).toBe(entry.capabilities!.forecast);
        expect(data.result.model_result.recovery_today_avg).toBeNull();
        const html = renderToStaticMarkup(<BundleAvailability data={data} />);
        expect(html).toContain(
          entry.capabilities!.timeline ? 'Cell timeline available.' : 'No cell timeline supplied.',
        );
        expect(html).toContain(
          entry.capabilities!.forecast
            ? 'Whole-fire forecast available.'
            : 'No whole-fire forecast supplied.',
        );
        expect(html).toContain(
          entry.capabilities!.imagery
            ? 'Satellite image supplied.'
            : 'No satellite image supplied.',
        );
        expect(html).toContain(
          entry.capabilities!.gedi
            ? 'measured GEDI observations supplied.'
            : 'No measured GEDI observations supplied.',
        );
        if (!entry.capabilities!.spatial) {
          expect(html).toContain('Perimeter and summary only');
          expect(data.result.lidar_points).toEqual([]);
        }
      }
      expect(catalog.filter((entry) => api.cachedFire(entry.id))).toHaveLength(3);
    },
  );

  it('retains recently used exports and refetches evicted resources', async () => {
    const { api, requests } = service(2);
    await api.loadFireIndex();
    const [a, b, c] = index.fires;
    const first = await api.loadFire(a!.id);
    await api.loadFire(b!.id);
    const before = requests.length;
    expect(await api.loadFire(a!.id)).toBe(first);
    expect(requests).toHaveLength(before);
    await api.loadFire(c!.id);
    expect(api.cachedFire(a!.id)).toBe(first);
    expect(api.cachedFire(b!.id)).toBeUndefined();
    expect(api.cachedFire(c!.id)).toBeDefined();
    await api.loadFire(b!.id);
    expect(api.cachedFire(a!.id)).toBeUndefined();
  });

  it('searches supplied identifiers, years and regions without changing catalog coordinates', () => {
    const fires = index.fires.map((entry) => bundleIndexEntry(entry, index.summer));
    expect(filterFireCatalog(fires, 'spain_2004_-641_3760').map((fire) => fire.id)).toEqual([
      'spain_2004_-641_3760',
    ]);
    expect(filterFireCatalog(fires, 'QUEBEC 1995')).toHaveLength(2);
    expect(filterFireCatalog(fires, '', 'greece')).toHaveLength(3);
    expect(filterFireCatalog(fires, '', 'turkey', '2021')).toHaveLength(2);
    expect(filterFireCatalog(fires, 'missing fire')).toEqual([]);
    expect(filterFireCatalog(fires, '   ')).toHaveLength(80);
    expect(filterFireCatalog(fires, '1987')[0]!.center_lonlat).toEqual([
      index.fires[1]!.lon,
      index.fires[1]!.lat,
    ]);
  });

  it('round-trips every selection through shareable URLs, including negative coordinate identifiers', () => {
    for (const entry of index.fires) {
      const state = { mode: 'examples' as const, presentation: 'fire' as const, fireId: entry.id };
      expect(mapStateOf(parseRoute(mapHref(state)))).toEqual(state);
    }
  });
});
