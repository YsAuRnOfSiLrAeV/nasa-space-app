import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FireIndexSchema, FireResultSchema, FireAssetPath } from '../../data/fireSchema';
import { StudyDataApi, DataLoadError } from '../../services/data/StudyDataApi';
import { fireGridFeatures, gridPosition, percent, suppliedCellIds } from './fireSpatial';

const folder = resolve(import.meta.dirname, '../../../public/data/demo');
const json = (file: string): unknown => JSON.parse(readFileSync(resolve(folder, file), 'utf8'));
const index = FireIndexSchema.parse(json('index.json'));
const result = FireResultSchema.parse(json(index[0]!.result));
const cellFile = `${index[0]!.id}/cells.json`;
const cells = json(cellFile);

function service(overrides: Record<string, unknown | number> = {}) {
  const files: Record<string, unknown> = {
    'index.json': index,
    [index[0]!.result]: result,
    [cellFile]: cells,
    ...overrides,
  };
  const requests: { path: string; signal: AbortSignal | null | undefined }[] = [];
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const path = String(input).replace('/base/data/demo/', '');
    requests.push({ path, signal: init?.signal });
    if (init?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const file = files[path];
    if (typeof file === 'number') return new Response('', { status: file });
    return new Response(JSON.stringify(file), { headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  return { api: new StudyDataApi({ baseUrl: '/base/data', fetch: fetchImpl }), requests };
}

describe('precomputed fire loading', () => {
  it('loads the delivered index, result and cells through the public data entry point', async () => {
    const { api, requests } = service();
    const data = await api.loadFire('bc_2003_490');
    expect(requests.map((request) => request.path)).toEqual([
      'index.json',
      'bc_2003_490/result.json',
      cellFile,
    ]);
    expect(data?.result.model_result.recovery_today_avg).toBe(0.36);
    expect(data?.cells.model.recovery.slice(0, 6)).toEqual([null, 97, 93, 58, 21, null]);
    expect(data?.cells.map.confidence.slice(0, 6)).toEqual([0, 2, 2, 2, 2, null]);
    expect(data?.opticalImageUrl).toBeNull();
  });

  it('resolves optical imagery relative to the result while respecting the app base path', async () => {
    const { api } = service({
      [index[0]!.result]: {
        ...result,
        files: { ...result.files, optical_image: 'images/optical.png' },
      },
    });
    expect((await api.loadFire('bc_2003_490'))?.opticalImageUrl).toBe(
      '/base/data/demo/bc_2003_490/images/optical.png',
    );
  });

  it('does not request a result for an unknown id', async () => {
    const { api, requests } = service();
    expect(await api.loadFire('../other')).toBeNull();
    expect(requests).toHaveLength(1);
  });

  it('rejects a result for a different fire', async () => {
    const { api } = service({
      [index[0]!.result]: { ...result, fire: { ...result.fire, id: 'other' } },
    });
    await expect(api.loadFire('bc_2003_490')).rejects.toThrow('does not match its catalog');
  });

  it('rejects truncated cell arrays instead of filling missing observations with zero', async () => {
    const { api } = service({
      [index[0]!.result]: { ...result, map_grid: { ...result.map_grid, rows: 1 } },
    });
    await expect(api.loadFire('bc_2003_490')).rejects.toThrow('grid dimensions');
  });

  it('reports a failed result request as an error', async () => {
    const { api } = service({ [index[0]!.result]: 500 });
    await expect(api.loadFire('bc_2003_490')).rejects.toBeInstanceOf(DataLoadError);
  });

  it('passes cancellation through to the data service', async () => {
    const { api, requests } = service();
    const controller = new AbortController();
    await api.loadFire('bc_2003_490', controller.signal);
    expect(requests.every((request) => request.signal === controller.signal)).toBe(true);
    controller.abort();
    await expect(api.loadFire('bc_2003_490', controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
  });

  it('rejects ambiguous ids and asset paths before requesting assets', () => {
    expect(FireIndexSchema.safeParse([...index, index[0]]).success).toBe(false);
    for (const path of [
      '../result.json',
      '/result.json',
      'https://example.com/a',
      '%2e%2e/a',
      'a\\b',
    ]) {
      expect(FireAssetPath.safeParse(path).success).toBe(false);
    }
  });
});

describe('fire spatial data and units', () => {
  it('keeps the four grid corners in their supplied order', () => {
    const grid = result.map_grid;
    expect(gridPosition(grid, 0, 0)).toEqual(grid.corners_lonlat[0]);
    expect(gridPosition(grid, grid.columns, 0)).toEqual(grid.corners_lonlat[1]);
    expect(gridPosition(grid, grid.columns, grid.rows)).toEqual(grid.corners_lonlat[2]);
    expect(gridPosition(grid, 0, grid.rows)).toEqual(grid.corners_lonlat[3]);
  });

  it('places only the five supplied entries and preserves the raw optical and model units', async () => {
    const data = (await service().api.loadFire('bc_2003_490'))!;
    expect(suppliedCellIds(data)).toEqual([0, 1, 2, 3, 4]);
    const features = fireGridFeatures(data).features;
    expect(features).toHaveLength(5);
    expect(features[0]!.properties).toMatchObject({
      stage: null,
      recovery: null,
      confidence: 0,
      ndvi: null,
    });
    expect(features[1]!.properties).toMatchObject({ recovery: 97, ndvi: 0.78, zone: 0 });
    const ring = features[1]!.geometry.coordinates[0]!;
    expect(ring[0]).toEqual(ring.at(-1));
  });

  it('distinguishes a zero value from a missing value and converts only summary fractions', () => {
    expect(percent(0)).toBe('0%');
    expect(percent(null)).toBe('Not supplied');
    expect(percent(0.36, 100)).toBe('36%');
    expect(percent(97)).toBe('97%');
  });
});
