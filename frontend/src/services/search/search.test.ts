import { describe, expect, it, vi } from 'vitest';
import { coverage, drawingPolygon } from './coverage';
import { simulateAnalysis } from './mockAnalysis';
import { AnalysisClient, pause } from './AnalysisClient';
import { CatalogFiresSchema, RunSchema, ZonesSchema, filterCatalog, type Zones } from './contracts';
import type { Polygon } from 'geojson';

const box = (west: number, east: number): Polygon => ({
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
const zones = (...polygons: Polygon[]): Zones =>
  ZonesSchema.parse({
    type: 'FeatureCollection',
    features: polygons.map((geometry) => ({
      type: 'Feature',
      geometry,
      properties: { label: 'Test only', supported: true },
    })),
  });
describe('coverage geometry', () => {
  it('rejects crossed and degenerate drawings', () => {
    expect(() =>
      drawingPolygon([
        [0, 0],
        [2, 2],
        [0, 2],
        [2, 0],
      ]),
    ).toThrow('crosses');
    expect(() =>
      drawingPolygon([
        [0, 0],
        [1, 0],
        [2, 0],
      ]),
    ).toThrow('non-zero');
    expect(
      drawingPolygon([
        [0, 0],
        [2, 0],
        [0, 2],
      ]).coordinates[0],
    ).toHaveLength(4);
  });
  it('distinguishes missing, zero, partial and complete coverage', () => {
    expect(coverage(box(0, 2), null)).toBeNull();
    expect(coverage(box(0, 2), zones(box(3, 4)))).toBe(0);
    expect(coverage(box(0, 2), zones(box(0, 1)))).toBeCloseTo(0.5);
    expect(coverage(box(0, 2), zones(box(0, 2)))).toBeCloseTo(1);
  });
  it('does not double count overlapping zones', () => {
    expect(coverage(box(0, 2), zones(box(0, 1), box(0, 1)))).toBeCloseTo(0.5);
  });
  it('respects holes', () => {
    const geometry = box(0, 2);
    geometry.coordinates.push([
      [0.5, 0.25],
      [0.5, 0.75],
      [1.5, 0.75],
      [1.5, 0.25],
      [0.5, 0.25],
    ]);
    expect(coverage(box(0, 2), zones(geometry))).toBeCloseTo(0.75, 3);
  });
});
describe('provisional service contract', () => {
  it('filters case-insensitively by name and exact year', () => {
    const fires = CatalogFiresSchema.parse([
      {
        id: 'test',
        name: 'Test boundary',
        year: 2003,
        center: [0, 0],
        perimeter: null,
        resultId: null,
      },
    ]);
    expect(filterCatalog(fires, ' TEST ', '2003')).toHaveLength(1);
    expect(filterCatalog(fires, 'test', '2004')).toHaveLength(0);
  });
  it('simulates success and failure without scientific output', async () => {
    vi.useFakeTimers();
    try {
      for (const fail of [false, true]) {
        const update = vi.fn();
        const result = simulateAnalysis(new AbortController().signal, fail, update);
        await vi.runAllTimersAsync();
        expect((await result).status).toBe(fail ? 'failed' : 'complete');
        expect(update).toHaveBeenCalledTimes(3);
      }
    } finally {
      vi.useRealTimers();
    }
  });
  it('polls an arbitrary step to a completed result', async () => {
    vi.useFakeTimers();
    try {
      const fetcher = vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ status: 'complete', result: 'https://example.test/result.json' }),
          ),
        );
      const result = new AnalysisClient('/api', fetcher).poll(
        { status: 'pending', id: 'a/b', step: 'Provider-defined step' },
        new AbortController().signal,
        vi.fn(),
      );
      await vi.advanceTimersByTimeAsync(1500);
      expect((await result).status).toBe('complete');
      expect(fetcher.mock.calls[0]![0]).toBe('/api/runs/a%2Fb');
    } finally {
      vi.useRealTimers();
    }
  });
  it('rejects invalid records and unknown run states', () => {
    expect(CatalogFiresSchema.safeParse([{ id: 'x', center: [999, 0] }]).success).toBe(false);
    expect(RunSchema.safeParse({ status: 'invented' }).success).toBe(false);
  });
  it('encodes parameters and validates response', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ summers: [2026] })));
    expect(
      await new AnalysisClient('/api', fetcher).summers('a & b', new AbortController().signal),
    ).toEqual([2026]);
    expect(fetcher.mock.calls[0]![0]).toBe('/api/summers?fire_id=a+%26+b');
  });
  it('cancels polling delays', async () => {
    const controller = new AbortController();
    const waiting = pause(30000, controller.signal);
    controller.abort(new Error('cancelled'));
    await expect(waiting).rejects.toThrow('cancelled');
  });
});
