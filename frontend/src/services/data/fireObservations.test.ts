import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FireResultSchema } from '@/data/fireSchema';
import { RecoveryFileSchema } from '@/data/recoverySchema';
import { FireObservationIndexSchema } from '@/data/fireObservations';
import { StudyDataApi } from '@/services/data/StudyDataApi';

const root = new URL('../../../public/data/', import.meta.url);
const file = (path: string): unknown => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const record = RecoveryFileSchema.parse(file('recovery/2002_205_-376.json'));
const bc = FireResultSchema.parse(file('demo/bc_2003_490/result.json'));
const [w, s, e, n] = record.bbox;
// A test-only fire result at the existing Ontario record's extent and fire year.
const ontario = {
  ...bc,
  fire: { ...bc.fire, id: 'test-ontario', year: record.fire_year },
  map_grid: {
    ...bc.map_grid,
    corners_lonlat: [
      [w, n],
      [e, n],
      [e, s],
      [w, s],
    ] as typeof bc.map_grid.corners_lonlat,
  },
};
const link = {
  fire_id: ontario.fire.id,
  fire_year: record.fire_year,
  group_id: record.group_id,
  basis: 'Test-only verified sampling association.',
};

function service(
  registry: unknown = { schema_version: 1, links: [link] },
  observation: unknown = record,
) {
  const requests: { path: string; signal?: AbortSignal | null }[] = [];
  const api = new StudyDataApi({
    baseUrl: '/nested/data',
    fetch: (async (input, init) => {
      const path = String(input).replace('/nested/data/', '');
      requests.push({ path, signal: init?.signal });
      const data = path === 'demo/observations.json' ? registry : observation;
      if (typeof data === 'number') return new Response('', { status: data });
      if (data === 'html')
        return new Response('<html/>', { headers: { 'content-type': 'text/html' } });
      return new Response(JSON.stringify(data), {
        headers: { 'content-type': 'application/json' },
      });
    }) as typeof fetch,
  });
  return { api, requests };
}

describe('fire-to-optical observation associations', () => {
  it('loads only an explicitly mapped record, preserves NDVI gaps and resolves images at the app base', async () => {
    const { api, requests } = service();
    const controller = new AbortController();
    const loaded = await api.loadFireObservations(ontario, controller.signal);
    expect(loaded?.record.ndvi).toEqual(record.ndvi);
    expect(loaded?.record.images[0]?.natural).toBe(`/nested/data/${record.images[0]!.natural}`);
    expect(requests.map((r) => r.path)).toEqual([
      'demo/observations.json',
      `recovery/${record.group_id}.json`,
    ]);
    expect(requests.every((r) => r.signal === controller.signal)).toBe(true);
  });

  it('does not substitute Ontario observations for an unlinked BC fire', async () => {
    const { api, requests } = service();
    expect(await api.loadFireObservations(bc)).toBeNull();
    expect(requests).toHaveLength(1);
  });

  it.each([404, 'html'])('treats missing optional registries as absent (%s)', async (registry) => {
    expect(await service(registry).api.loadFireObservations(bc)).toBeNull();
  });

  it('rejects wrong fire years before loading the linked record', async () => {
    const { api, requests } = service({ schema_version: 1, links: [{ ...link, fire_year: 1999 }] });
    await expect(api.loadFireObservations(ontario)).rejects.toThrow('wrong fire year');
    expect(requests).toHaveLength(1);
  });

  it('rejects same-year records at another geographic location', async () => {
    const sameYearBC = { ...bc, fire: { ...bc.fire, year: record.fire_year } };
    const { api } = service({ schema_version: 1, links: [{ ...link, fire_id: bc.fire.id }] });
    await expect(api.loadFireObservations(sameYearBC)).rejects.toThrow('does not overlap');
  });

  it('reports missing, failed and mismatched mapped records as errors', async () => {
    await expect(service(undefined, 404).api.loadFireObservations(ontario)).rejects.toThrow(
      'not been published',
    );
    await expect(service(undefined, 500).api.loadFireObservations(ontario)).rejects.toThrow();
    await expect(
      service(undefined, { ...record, fire_year: 1995 }).api.loadFireObservations(ontario),
    ).rejects.toThrow('fire year');
    await expect(
      service(undefined, { ...record, group_id: 'other' }).api.loadFireObservations(ontario),
    ).rejects.toThrow('sampling group');
  });

  it('rejects ambiguous duplicate mappings and unsafe group identifiers', () => {
    expect(
      FireObservationIndexSchema.safeParse({ schema_version: 1, links: [link, link] }).success,
    ).toBe(false);
    expect(
      FireObservationIndexSchema.safeParse({
        schema_version: 1,
        links: [{ ...link, group_id: '../other' }],
      }).success,
    ).toBe(false);
  });
});
