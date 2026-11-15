import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BundleIndexSchema, bundleIndexEntry } from '@/data/bundleV2';
import { CatalogPerimetersSchema } from '@/data/catalogPerimeters';
import { ApplicabilityZonesSchema } from '@/data/applicabilityZones';
import { exportedSearchFires, catalogCountries } from './exportedCatalog';
import { boundaryOverlap, canAnalyze, precomputedHref } from './selection';
import { drawingPolygon } from './coverage';
import { filterCatalog } from './contracts';
import { evaluateApplicability } from './applicability';
import { StudyDataApi } from '@/services/data/StudyDataApi';
import { mapStateOf, parseRoute } from '@/app/route';

const root = resolve(import.meta.dirname, '../../../public/data/bundle-v2');
const read = (path: string): unknown => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const index = BundleIndexSchema.parse(read('index.json'));
const entries = index.fires.map((entry) => bundleIndexEntry(entry, index.summer));
const perimeters = CatalogPerimetersSchema.parse(read('perimeters.geojson'));
const fires = exportedSearchFires(entries, perimeters);

describe('Find Your Fire exported catalog connection', () => {
  it('registers all 80 original locations, perimeters and result ids while preserving capability distinctions', () => {
    expect(fires).toHaveLength(80);
    expect(fires.filter((fire) => fire.spatial)).toHaveLength(37);
    expect(fires.filter((fire) => fire.spatial === false)).toHaveLength(43);
    fires.forEach((fire, i) => {
      expect(fire.center).toEqual([index.fires[i]!.lon, index.fires[i]!.lat]);
      expect(fire.perimeter).toEqual(
        perimeters.features.find((feature) => feature.properties.id === fire.id)!.geometry,
      );
      expect(fire.resultId).toBe(fire.id);
    });
    expect(catalogCountries(fires).map((country) => country.code)).toEqual([
      'canada',
      'greece',
      'spain',
      'tanzania',
      'turkey',
      'ukraine',
      'zambia',
    ]);
    expect(fires.find((fire) => fire.id === 'bc_2003_490')!.country).toBe('canada');
    expect(filterCatalog(fires, 'QUEBEC 1995', '')).toHaveLength(2);
    expect(filterCatalog(fires, 'spain_2004_-641_3760', '')).toHaveLength(1);
  });
  it('finds real overlapping fire datasets from a drawn source-bounds polygon', () => {
    const fire = fires.find((fire) => fire.id === 'bc_2003_490')!;
    const positions =
      fire.perimeter!.type === 'Polygon'
        ? fire.perimeter!.coordinates.flat()
        : fire.perimeter!.coordinates.flat(2);
    const west = Math.min(...positions.map((p) => p[0]));
    const east = Math.max(...positions.map((p) => p[0]));
    const south = Math.min(...positions.map((p) => p[1]));
    const north = Math.max(...positions.map((p) => p[1]));
    const boundary = drawingPolygon([
      [west, south],
      [east, south],
      [east, north],
      [west, north],
    ]);
    expect(boundaryOverlap(fire, boundary)).toBeCloseTo(1);
    const partial = drawingPolygon([
      [west, south],
      [(west + east) / 2, south],
      [(west + east) / 2, north],
      [west, north],
    ]);
    expect(boundaryOverlap(fire, partial)).toBeGreaterThan(0);
    expect(boundaryOverlap(fire, partial)).toBeLessThan(1);
    const empty = drawingPolygon([
      [-0.1, -0.1],
      [0.1, -0.1],
      [0.1, 0.1],
      [-0.1, 0.1],
    ]);
    expect(fires.filter((entry) => (boundaryOverlap(entry, empty) ?? 0) > 0)).toEqual([]);
  });
  it('never substitutes points for missing perimeter geometry', () => {
    const missing = exportedSearchFires(entries, null);
    const boundary = drawingPolygon([
      [-121, 51],
      [-120, 51],
      [-120, 52],
      [-121, 52],
    ]);
    expect(missing.every((fire) => fire.perimeter === null)).toBe(true);
    expect(boundaryOverlap(missing[0]!, boundary)).toBeNull();
    expect(missing[0]!.resultId).toBe(missing[0]!.id);
  });
  it('does not attach mismatched perimeter metadata or accept duplicate identities', () => {
    const source = perimeters.features[0]!;
    const invalid = {
      ...perimeters,
      features: [
        { ...source, properties: { ...source.properties, year: source.properties.year + 1 } },
      ],
    };
    expect(
      exportedSearchFires(entries, invalid).find((fire) => fire.id === source.properties.id)!
        .perimeter,
    ).toBeNull();
    expect(
      CatalogPerimetersSchema.safeParse({ ...perimeters, features: [source, source] }).success,
    ).toBe(false);
  });
  it('opens a known search match through the shared loader and route, without a prediction request', async () => {
    const requests: string[] = [];
    const api = new StudyDataApi({
      baseUrl: '/data',
      bundleBaseUrl: '/bundle',
      fetch: (async (input) => {
        const url = String(input);
        requests.push(url);
        const folder = url.startsWith('/bundle/') ? root : resolve(root, '..');
        return new Response(
          readFileSync(resolve(folder, url.replace(/^\/(data|bundle)\//, '')), 'utf8'),
        );
      }) as typeof fetch,
    });
    const catalog = await api.loadFireIndex();
    const geometry = await api.loadFirePerimeters();
    const zones = await api.loadApplicabilityZones();
    expect(requests).toHaveLength(4);
    const selected = exportedSearchFires(catalog, geometry).find(
      (fire) => fire.id === 'quebec_1995_1218',
    )!;
    const route = mapStateOf(parseRoute(precomputedHref(selected.resultId!)));
    expect(route?.fireId).toBe(selected.id);
    const result = await api.loadFire(route!.fireId!);
    expect(result!.bundle!.cells).toHaveLength(6533);
    expect(zones!.features).toHaveLength(8);
    expect(requests.every((url) => !url.includes('/runs') && !url.includes('/summers'))).toBe(true);
    expect(
      canAnalyze({
        drawing: false,
        processing: false,
        summer: 2026,
        mock: false,
        selectedCoverage: 1,
        matchesBoundary: true,
      }),
    ).toBe(false);
  });
});

describe('provider geographic applicability', () => {
  const box = (west: number, east: number) =>
    drawingPolygon([
      [west, 0],
      [east, 0],
      [east, 1],
      [west, 1],
    ]);
  const zones = ApplicabilityZonesSchema.parse({
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: box(0, 2),
        properties: {
          layer: 'model1_region',
          region: 'test',
          tier: 1,
          status: 'verified',
          reliability: 'good',
          name_en: 'Test only verified',
        },
      },
      {
        type: 'Feature',
        geometry: box(1, 3),
        properties: {
          layer: 'model1_region',
          region: 'test',
          tier: 2,
          status: 'extrapolated',
          reliability: 'good',
          name_en: 'Test only extrapolated',
        },
      },
      {
        type: 'Feature',
        geometry: box(0, 1),
        properties: { layer: 'model2_growth', status: 'verified', name_en: 'Test only growth' },
      },
      {
        type: 'Feature',
        geometry: box(10, 11),
        properties: { layer: 'model2_scenario', status: 'verified', name_en: 'Test only scenario' },
      },
    ],
  });
  it('separates verified, extrapolated and outside coverage without double counting', () => {
    const result = evaluateApplicability(box(0, 4), zones)!;
    expect(result.model1Verified).toBeCloseTo(0.5);
    expect(result.model1Extrapolated).toBeCloseTo(0.25);
    expect(result.model1Outside).toBeCloseTo(0.25);
    expect(result.growthVerified).toBeCloseTo(0.25);
    expect(result.scenarioVerified).toBe(0);
    expect(evaluateApplicability(box(5, 6), zones)!.model1Outside).toBe(1);
  });
  it('keeps absent coverage unknown and rejects conflicting confidence semantics', () => {
    expect(evaluateApplicability(box(0, 1), null)).toBeNull();
    expect(
      evaluateApplicability(box(0, 1), { type: 'FeatureCollection', features: [] }),
    ).toBeNull();
    const partial = {
      ...zones,
      features: zones.features.filter((feature) => feature.properties.layer === 'model2_growth'),
    };
    expect(evaluateApplicability(box(0, 1), partial)!.model1Outside).toBeNull();
    expect(
      ApplicabilityZonesSchema.safeParse({
        type: 'FeatureCollection',
        features: [
          {
            ...zones.features[0],
            properties: { ...zones.features[0]!.properties, tier: 2, status: 'verified' },
          },
        ],
      }).success,
    ).toBe(false);
  });
  it.each(['bc_2003_490', 'ukraine_2020_3009_5131'])(
    'evaluates %s against the actual supplied zones, separately from export availability',
    (id) => {
      const sourceZones = ApplicabilityZonesSchema.parse(read('confidence_zones.geojson'));
      const fire = fires.find((fire) => fire.id === id)!;
      const result = evaluateApplicability(fire.perimeter!, sourceZones)!;
      expect(result.growthVerified).toBeCloseTo(id.startsWith('bc_') ? 1 : 0);
      expect(result.scenarioVerified).toBeCloseTo(id.startsWith('ukraine_') ? 1 : 0);
      for (const share of Object.values(result))
        expect(share === null || (share >= 0 && share <= 1)).toBe(true);
      expect(fire.resultId).toBe(id);
    },
  );
  it('treats missing or malformed zone files as unavailable instead of authorizing analysis', async () => {
    const missing = new StudyDataApi({
      baseUrl: '/data',
      bundleBaseUrl: '/bundle',
      fetch: (async () => new Response('', { status: 404 })) as typeof fetch,
    });
    expect(await missing.loadApplicabilityZones()).toBeNull();
    const invalid = new StudyDataApi({
      baseUrl: '/data',
      bundleBaseUrl: '/bundle',
      fetch: (async () => new Response('{}')) as typeof fetch,
    });
    await expect(invalid.loadApplicabilityZones()).rejects.toThrow();
  });
});
