import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DataLoadError, StudyDataApi } from './StudyDataApi';

const DATA = resolve(import.meta.dirname, '../../../public/data');
const file = (name: string) => readFileSync(resolve(DATA, name), 'utf8');

/** A fake fetch that serves named bodies and records the URLs it was asked for. */
function fakeFetch(bodies: Record<string, string | number>) {
  const urls: string[] = [];
  const impl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    urls.push(url);
    if (init?.signal?.aborted) throw new DOMException('aborted', 'AbortError');
    const body = bodies[url.split('/').pop()!];
    if (body === undefined || typeof body === 'number') {
      return new Response('', { status: typeof body === 'number' ? body : 404 });
    }
    return new Response(body, { status: 200 });
  }) as typeof fetch;
  return { impl, urls };
}

const api = (bodies: Record<string, string | number>) => {
  const f = fakeFetch(bodies);
  return { api: new StudyDataApi({ baseUrl: 'http://mock/data', fetch: f.impl }), urls: f.urls };
};

describe('StudyDataApi', () => {
  it('loads and validates the study files from the injected base URL', async () => {
    const { api: a, urls } = api({
      'manifest.json': file('manifest.json'),
      'points.geojson': file('points.geojson'),
    });
    const study = await a.loadStudy();
    expect(urls.sort()).toEqual([
      'http://mock/data/manifest.json',
      'http://mock/data/points.geojson',
    ]);
    expect(study.points.features).toHaveLength(study.manifest.counts.points);
  });

  it('loads the land mask and decodes it to [lon, lat] pairs', async () => {
    const { api: a } = api({ 'land-dots.json': file('land-dots.json') });
    const mask = await a.loadLandMask();
    const raw = JSON.parse(file('land-dots.json')) as { count: number; source: string };
    expect(mask.dots).toHaveLength(raw.count);
    expect(mask.source).toBe(raw.source);
    for (const [lon, lat] of mask.dots.slice(0, 50)) {
      expect(Math.abs(lon)).toBeLessThanOrEqual(180);
      expect(Math.abs(lat)).toBeLessThanOrEqual(90);
    }
  });

  it('names the rebuild command for a missing file', async () => {
    const { api: a } = api({ 'manifest.json': file('manifest.json') });
    await expect(a.loadStudy()).rejects.toThrow('points.geojson not found. Run `npm run data`');
    await expect(a.loadLandMask()).rejects.toThrow('Run `npm run data:globe`');
  });

  it('reports other HTTP failures, bad JSON and contract mismatches as DataLoadError', async () => {
    const { api: a } = api({ 'land-dots.json': 500 });
    await expect(a.loadLandMask()).rejects.toThrow('land-dots.json failed to load (HTTP 500).');

    const { api: b } = api({ 'land-dots.json': '{not json' });
    await expect(b.loadLandMask()).rejects.toThrow('land-dots.json is not valid JSON.');

    const { api: c } = api({
      'land-dots.json': JSON.stringify({ source: 'x', count: 0, lonlat: [] }),
    });
    const err = await c.loadLandMask().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DataLoadError);
    expect((err as Error).message).toMatch(/does not match the data contract \(count: /);
  });

  it('turns a network failure into a readable message', async () => {
    const failing = (async () => {
      throw new TypeError('Failed to fetch');
    }) as typeof fetch;
    const a = new StudyDataApi({ baseUrl: '/data', fetch: failing });
    await expect(a.loadLandMask()).rejects.toThrow(
      'Could not reach land-dots.json. Check your connection and try again.',
    );
  });

  it('rethrows an abort untouched so callers can ignore it', async () => {
    const { api: a } = api({ 'land-dots.json': file('land-dots.json') });
    const ctrl = new AbortController();
    ctrl.abort();
    const err = await a.loadLandMask(ctrl.signal).catch((e: unknown) => e);
    expect(err).not.toBeInstanceOf(DataLoadError);
    expect((err as Error).name).toBe('AbortError');
  });
});

describe('StudyDataApi.loadRecovery (optional per-group Landsat data)', () => {
  const minimal = {
    schema_version: 1,
    group_id: 'g1',
    fire_year: 2002,
    bbox: [-94, 51.3, -93.8, 51.5],
    season: { from: '06-15', to: '09-15' },
    years: [2001, 2002],
    reference: { point_ids: ['r'], max_distance_km: 12 },
    source: { collection: 'c', access: 'a', citation: 'USGS', doi: [] },
    scenes: [],
    images: [],
    ndvi: [
      {
        year: 2001,
        platforms: ['landsat-7'],
        burned: { median: 0.8, n_points: 3, n_obs: 5 },
        reference: null,
      },
      { year: 2002, platforms: [], burned: null, reference: null },
    ],
  };
  const respond = (body: string, status: number, type: string) =>
    (async () => new Response(body, { status, headers: { 'Content-Type': type } })) as typeof fetch;

  it('parses a fetched group', async () => {
    const a = new StudyDataApi({
      baseUrl: '/data',
      fetch: respond(JSON.stringify(minimal), 200, 'application/json'),
    });
    const r = await a.loadRecovery('g1');
    expect(r?.ndvi[1]?.burned).toBeNull();
  });

  it('resolves image paths against the base URL, so components never build one', async () => {
    const image = {
      scene_id: 's',
      date: '2001-08-02',
      platform: 'landsat-7',
      clear_share: 1,
      natural: 'recovery/g1/s-natural.jpg',
      swir: 'recovery/g1/s-swir.jpg',
    };
    const a = new StudyDataApi({
      baseUrl: '/base/data',
      fetch: respond(JSON.stringify({ ...minimal, images: [image] }), 200, 'application/json'),
    });
    const r = await a.loadRecovery('g1');
    expect(r?.images[0]).toMatchObject({
      natural: '/base/data/recovery/g1/s-natural.jpg',
      swir: '/base/data/recovery/g1/s-swir.jpg',
    });
  });

  it('resolves to null when the group was never fetched (404 or the dev index.html fallback)', async () => {
    const notFound = new StudyDataApi({ baseUrl: '/data', fetch: respond('', 404, 'text/plain') });
    const fallback = new StudyDataApi({
      baseUrl: '/data',
      fetch: respond('<!doctype html>', 200, 'text/html'),
    });
    expect(await notFound.loadRecovery('g1')).toBeNull();
    expect(await fallback.loadRecovery('g1')).toBeNull();
  });

  it('rejects a malformed file with the command that rebuilds it', async () => {
    const bad = { ...minimal, ndvi: [{ year: 2001 }] };
    const a = new StudyDataApi({
      baseUrl: '/data',
      fetch: respond(JSON.stringify(bad), 200, 'application/json'),
    });
    await expect(a.loadRecovery('g1')).rejects.toThrow('npm run data:landsat -- --group g1');
  });

  it('loads AppEEARS from its own folder and retains the source and quality policy', async () => {
    const urls: string[] = [];
    const a = new StudyDataApi({
      baseUrl: '/base/data',
      fetch: (async (url) => {
        urls.push(String(url));
        return new Response(
          JSON.stringify({
            ...minimal,
            source: {
              ...minimal.source,
              collection: 'MOD13Q1.061',
              access: 'NASA AppEEARS',
              quality_policy: 'Pixel reliability = 0',
            },
          }),
          { headers: { 'Content-Type': 'application/json' } },
        );
      }) as typeof fetch,
    });
    expect((await a.loadRecovery('g1', undefined, 'appeears'))?.source.quality_policy).toBe(
      'Pixel reliability = 0',
    );
    expect(urls).toEqual(['/base/data/appeears/g1.json']);
  });

  it('rejects duplicate years before they can produce ambiguous chart or trend values', async () => {
    const a = new StudyDataApi({
      baseUrl: '/data',
      fetch: respond(
        JSON.stringify({ ...minimal, ndvi: [minimal.ndvi[0], minimal.ndvi[0]] }),
        200,
        'application/json',
      ),
    });
    await expect(a.loadRecovery('g1')).rejects.toThrow('Observation years');
  });

  it('keeps HTTP failures distinct from an absent optional record', async () => {
    const a = new StudyDataApi({
      baseUrl: '/data',
      fetch: respond('Unavailable', 503, 'text/html'),
    });
    await expect(a.loadRecovery('g1')).rejects.toThrow('HTTP 503');
  });
});

describe('Canadian geographic context', () => {
  const snapshot = file('context/bc_2003_490.json');
  it('loads the cached official lake boundaries with attribution', async () => {
    const { api: a } = api({ 'bc_2003_490.json': snapshot });
    const context = await a.loadCanadianContext('bc_2003_490');
    expect(context?.water.features.length).toBeGreaterThan(0);
    expect(context?.source.service).toContain('maps.gov.bc.ca');
    expect(context?.source.attribution).toContain('Open Government Licence');
  });
  it('rejects context for another fire and preserves missing snapshots as missing', async () => {
    const wrong = api({ 'other.json': snapshot }).api;
    await expect(wrong.loadCanadianContext('other')).rejects.toThrow('does not match');
    expect(await api({}).api.loadCanadianContext('missing')).toBeNull();
  });
});
