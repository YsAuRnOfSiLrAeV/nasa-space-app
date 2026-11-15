import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FireIndexSchema, FireResultSchema, FireAssetPath } from '../../data/fireSchema';
import { StudyDataApi, DataLoadError } from './StudyDataApi';

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
  it('loads backend exports with omitted layers through the same data service', async () => {
    const { api } = service({
      [cellFile]: {
        map: { zone: Array(result.map_grid.rows * result.map_grid.columns).fill(null) },
      },
    });
    const data = await api.loadFire(index[0]!.id);
    expect(data?.cells.model.stage).toHaveLength(result.map_grid.rows * result.map_grid.columns);
    expect(data?.cells.model.stage.every((value) => value === null)).toBe(true);
    expect(data?.opticalImageUrl).toBeNull();
  });
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

describe('shared fire export cache', () => {
  it('shares exports across callers, bypasses on retry, and can be invalidated', async () => {
    const copy = structuredClone(result);
    const { api, requests } = service({ [index[0]!.result]: copy });
    const first = await api.loadFire('bc_2003_490');
    expect(await api.loadFire('bc_2003_490')).toBe(first);
    expect(requests).toHaveLength(3);
    copy.model_result.recovery_today_avg = 0.5;
    const fresh = await api.loadFire('bc_2003_490', undefined, { fresh: true });
    expect(fresh?.result.model_result.recovery_today_avg).toBe(0.5);
    expect(api.cachedFire('bc_2003_490')).toBe(fresh);
    expect(requests).toHaveLength(6);
    api.clearFireCache('bc_2003_490');
    expect(api.cachedFire('bc_2003_490')).toBeUndefined();
    await api.loadFire('bc_2003_490');
    // The catalog already loaded is reused: only the result and cells are requested again.
    expect(requests.slice(6).map((request) => request.path)).toEqual([
      'bc_2003_490/result.json',
      cellFile,
    ]);
    api.clearFireCache();
    expect(api.cachedFire('bc_2003_490')).toBeUndefined();
  });

  it('requests the catalog once for the catalog and the fires read from it', async () => {
    const { api, requests } = service();
    const catalog = api.loadFireIndex();
    const fire = api.loadFire('bc_2003_490');
    expect((await catalog).length).toBeGreaterThan(0);
    expect(await fire).not.toBeNull();
    expect(requests.filter((request) => request.path === 'index.json')).toHaveLength(1);
  });

  it('asks for the catalog again when the shared request was cancelled or failed', async () => {
    const { api, requests } = service();
    const controller = new AbortController();
    controller.abort();
    await expect(api.loadFireIndex(controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(await api.loadFire('bc_2003_490')).not.toBeNull();
    expect(requests.filter((request) => request.path === 'index.json')).toHaveLength(2);
  });

  it('does not let an older request overwrite a fresh export', async () => {
    let unblock!: (response: Response) => void;
    let entered!: () => void;
    const waiting = new Promise<void>((resolve) => {
      entered = resolve;
    });
    let resultLoads = 0;
    let cellLoads = 0;
    const response = (data: unknown) =>
      new Response(JSON.stringify(data), {
        headers: { 'content-type': 'application/json' },
      });
    const fetchImpl = (async (input) => {
      const file = String(input);
      if (file.endsWith('/index.json')) return response(index);
      if (file.endsWith('/result.json')) {
        const next = structuredClone(result);
        next.model_result.recovery_today_avg = ++resultLoads === 1 ? 0.36 : 0.5;
        return response(next);
      }
      if (++cellLoads === 1) {
        entered();
        return new Promise<Response>((resolve) => {
          unblock = resolve;
        });
      }
      return response(cells);
    }) as typeof fetch;
    const api = new StudyDataApi({ baseUrl: '/data', fetch: fetchImpl });
    const old = api.loadFire('bc_2003_490');
    await waiting;
    const latest = await api.loadFire('bc_2003_490', undefined, { fresh: true });
    unblock(response(cells));
    expect((await old)?.result.model_result.recovery_today_avg).toBe(0.36);
    expect(api.cachedFire('bc_2003_490')).toBe(latest);
    expect(latest?.result.model_result.recovery_today_avg).toBe(0.5);
  });

  it('does not serve cached exports to already-aborted callers', async () => {
    const { api } = service();
    await api.loadFire('bc_2003_490');
    const controller = new AbortController();
    controller.abort();
    await expect(api.loadFire('bc_2003_490', controller.signal)).rejects.toThrow();
  });
});
