import type { Polygon } from 'geojson';
import { describe, expect, it } from 'vitest';
import { AnalysisClient } from './AnalysisClient';
import { atlasDates, atlasSummary, isAtlasFire } from './atlas';
import { AtlasSearchSchema, type AtlasFire, type AtlasSearch } from './contracts';

const polygon: Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [-120.6, 50.9],
      [-119.8, 50.9],
      [-119.8, 51.4],
      [-120.6, 50.9],
    ],
  ],
};
const fire: AtlasFire = {
  id: 'gfa_30026097',
  year: 2003,
  start_date: '2003-07-31',
  end_date: '2003-08-20',
  area_ha: 24588,
  center: [-120.134, 51.1438],
  tier: 'A',
  perimeter: polygon as AtlasFire['perimeter'],
  overlap: 0.73,
};
const found = (patch: Partial<AtlasSearch>): AtlasSearch => ({
  status: 'ok',
  regions: { A: 0.6, B: 0.4 },
  total: 1,
  truncated: false,
  fires: [fire],
  ...patch,
});

describe('fire atlas search', () => {
  it('tells a polygon outside every model region from one with no fires', () => {
    const outside = atlasSummary(found({ status: 'outside_regions', regions: {}, fires: [] }));
    expect(outside).toContain('does not touch any region');
    const empty = atlasSummary(found({ status: 'no_fires', total: 0, fires: [] }));
    expect(empty).toContain('no fire under this polygon');
    expect(empty).toContain('60% of the polygon is in a verified model region and 40%');
    expect(empty).not.toContain('does not touch');
  });

  it('counts the fires and says when only the largest are listed', () => {
    expect(atlasSummary(found({}))).toMatch(/^1 fire under this polygon\. 60%/);
    const many = atlasSummary(found({ total: 250, truncated: true }));
    expect(many).toContain('250 fires under this polygon. The 1 largest are listed.');
    expect(many).toContain('narrow the polygon or the filters');
  });

  it('recognises atlas ids and formats burn dates', () => {
    expect(isAtlasFire('gfa_30026097')).toBe(true);
    expect(isAtlasFire('bc_2003_490')).toBe(false);
    expect(isAtlasFire(null)).toBe(false);
    expect(atlasDates(fire)).toBe('Jul 31 – Aug 20');
    expect(atlasDates({ ...fire, end_date: fire.start_date })).toBe('Jul 31');
  });

  it('posts the polygon and filters to the search endpoint and validates the answer', async () => {
    const calls: { url: string; body: unknown }[] = [];
    const fetcher = (async (url: string, init?: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init?.body)) });
      return new Response(JSON.stringify(found({})), {
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;
    const client = new AnalysisClient('/api/', fetcher);
    const result = await client.searchFires(
      polygon,
      { yearFrom: 2003, minAreaHa: 500 },
      new AbortController().signal,
    );
    expect(result.fires[0]?.id).toBe('gfa_30026097');
    expect(calls).toEqual([
      { url: '/api/fires/search', body: { polygon, year_from: 2003, min_area_ha: 500 } },
    ]);
  });

  it('rejects an answer with an unknown status', () => {
    expect(AtlasSearchSchema.safeParse({ ...found({}), status: 'maybe' }).success).toBe(false);
  });
});
