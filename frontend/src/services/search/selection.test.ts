import { describe, expect, it, vi } from 'vitest';
import type { Polygon } from 'geojson';
import { boundaryOverlap, canAnalyze, precomputedHref } from './selection';
import { coverage } from './coverage';
import { CatalogFiresSchema, ZonesSchema } from './contracts';
import { AnalysisClient } from './AnalysisClient';
import { parseRoute } from '@/app/route';

const rectangle = (west: number, east: number): Polygon => ({
  type: 'Polygon',
  coordinates: [
    [
      [west, 0],
      [east, 0],
      [east, 1],
      [west, 1],
      [west, 0],
    ],
  ],
});
const fire = CatalogFiresSchema.parse([
  {
    id: 'catalog-id',
    name: 'Test only',
    year: 2003,
    center: [1, 0.5],
    perimeter: rectangle(0, 2),
    resultId: 'result-id',
  },
])[0]!;
const allowed = {
  drawing: false,
  processing: false,
  summer: 2026,
  mock: false,
  selectedCoverage: 1,
  matchesBoundary: true,
};

describe('catalog boundary selection', () => {
  it('reports the fraction of the fire selected and excludes disjoint fires', () => {
    expect(boundaryOverlap(fire, rectangle(0, 1))).toBeCloseTo(0.5);
    expect(boundaryOverlap(fire, rectangle(3, 4))).toBe(0);
    expect(boundaryOverlap(fire, null)).toBe(1);
  });
  it('leaves missing perimeters unknown instead of using point coordinates', () => {
    expect(boundaryOverlap({ ...fire, perimeter: null }, rectangle(0, 2))).toBeNull();
  });
  it('does not count boundary contact without overlapping area', () => {
    expect(boundaryOverlap(fire, rectangle(2, 3))).toBe(0);
  });
  it('does not let a supported drawing authorize an unsupported selected fire', () => {
    const zones = ZonesSchema.parse({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: rectangle(3, 4),
          properties: { label: 'Test only', supported: true },
        },
      ],
    });
    expect(coverage(rectangle(3, 4), zones)).toBeCloseTo(1);
    const selectedCoverage = coverage(fire.perimeter!, zones);
    expect(canAnalyze({ ...allowed, selectedCoverage })).toBe(false);
  });
});

describe('analysis eligibility and routing', () => {
  it('blocks unfinished drawings for both real and mock requests', () => {
    expect(canAnalyze(allowed)).toBe(false);
    expect(canAnalyze({ ...allowed, mock: true })).toBe(true);
    expect(canAnalyze({ ...allowed, drawing: true })).toBe(false);
    expect(canAnalyze({ ...allowed, drawing: true, mock: true })).toBe(false);
    expect(canAnalyze({ ...allowed, matchesBoundary: false })).toBe(false);
    expect(canAnalyze({ ...allowed, selectedCoverage: null })).toBe(false);
    expect(canAnalyze({ ...allowed, summer: undefined })).toBe(false);
  });
  it('opens different result ids in the shared Examples route', () => {
    expect(parseRoute(precomputedHref(fire.resultId!))).toEqual({
      page: 'explore',
      map: {
        mode: 'examples',
        presentation: 'fire',
        fireId: 'result-id',
      },
    });
  });
  it('requests analysis for the catalog fire and summer only', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ status: 'pending', id: 'run-id' })));
    await new AnalysisClient('/api', fetcher).start(fire.id, 2026, new AbortController().signal);
    expect(JSON.parse(fetcher.mock.calls[0]![1].body)).toEqual({
      fire_id: 'catalog-id',
      summer: 2026,
    });
  });
});
