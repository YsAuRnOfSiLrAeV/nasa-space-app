import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  FireCellsSchema,
  FireResultSchema,
  validateFireCells,
  type FireData,
} from '@/data/fireSchema';
import { mockUploadResult, parseFireUpload, runMockAnalysis, type Perimeter } from './mockAnalysis';

const shape: Perimeter = {
  type: 'Polygon',
  coordinates: [
    [
      [-96, 51],
      [-95, 51],
      [-95, 52],
      [-96, 52],
      [-96, 51],
    ],
  ],
};
const upload = { kind: 'upload' as const, name: 'My test fire', fireYear: 2002, perimeter: shape };
function catalogData(): FireData {
  const root = new URL('../../../public/data/demo/bc_2003_490/', import.meta.url);
  return {
    result: FireResultSchema.parse(JSON.parse(readFileSync(new URL('result.json', root), 'utf8'))),
    cells: FireCellsSchema.parse(JSON.parse(readFileSync(new URL('cells.json', root), 'utf8'))),
    opticalImageUrl: null,
  };
}
afterEach(() => vi.useRealTimers());

describe('uploaded fire validation and mock grids', () => {
  it('accepts bare geometries, features and one-feature collections', () => {
    expect(parseFireUpload(JSON.stringify(shape))).toEqual(shape);
    const feature = {
      type: 'Feature',
      properties: { name: '<script>ignored</script>' },
      geometry: shape,
    };
    expect(parseFireUpload(JSON.stringify(feature))).toEqual(shape);
    expect(
      parseFireUpload(JSON.stringify({ type: 'FeatureCollection', features: [feature] })),
    ).toEqual(shape);
  });
  it('accepts MultiPolygon geometry', () => {
    const multi = { type: 'MultiPolygon', coordinates: [shape.coordinates] };
    expect(parseFireUpload(JSON.stringify(multi))).toEqual(multi);
  });
  it.each([
    'not json',
    '{}',
    '{"type":"Point","coordinates":[-95,51]}',
    '{"type":"Feature","geometry":null}',
    '{"type":"FeatureCollection","features":[]}',
  ])('rejects unsupported or malformed input: %s', (text) => {
    expect(() => parseFireUpload(text)).toThrow();
  });
  it('rejects open, zero-area, self-crossing and out-of-range rings', () => {
    const parse = (coordinates: number[][]) =>
      parseFireUpload(JSON.stringify({ type: 'Polygon', coordinates: [coordinates] }));
    expect(() =>
      parse([
        [-96, 51],
        [-95, 51],
        [-95, 52],
        [-96, 52],
      ]),
    ).toThrow('closed rings');
    expect(() =>
      parse([
        [0, 0],
        [1, 1],
        [2, 2],
        [0, 0],
      ]),
    ).toThrow('non-zero area');
    expect(() =>
      parse([
        [0, 0],
        [2, 2],
        [0, 2],
        [2, 0],
        [0, 0],
      ]),
    ).toThrow('crosses itself');
    expect(() =>
      parse([
        [200, 51],
        [201, 51],
        [201, 52],
        [200, 51],
      ]),
    ).toThrow();
    expect(() =>
      parse([
        [0, 86],
        [1, 86],
        [1, 87],
        [0, 86],
      ]),
    ).toThrow('85°');
  });
  it('clips the illustrative grid to holes and leaves unsupported scientific fields missing', () => {
    const withHole: Perimeter = {
      type: 'Polygon',
      coordinates: [
        ...shape.coordinates,
        [
          [-95.8, 51.2],
          [-95.2, 51.2],
          [-95.2, 51.8],
          [-95.8, 51.8],
          [-95.8, 51.2],
        ],
      ],
    };
    const data = mockUploadResult({ ...upload, perimeter: withHole });
    expect(FireResultSchema.safeParse(data.result).success).toBe(true);
    expect(FireCellsSchema.safeParse(data.cells).success).toBe(true);
    expect(() => validateFireCells(data.cells, data.result.map_grid)).not.toThrow();
    expect(data.cells.model.recovery[10 * 20 + 10]).toBeNull();
    expect(data.cells.model.recovery.some((v) => v != null)).toBe(true);
    expect(data.cells.model.stage.every((v) => v == null)).toBe(true);
    expect(data.cells.model.p_forest_gt5.every((v) => v == null)).toBe(true);
    expect(data.cells.optics.ndvi.every((v) => v == null)).toBe(true);
    expect(data.result.warnings).toContain('MOCK_RESULT');
    expect(data.result.growth_forecast).toBeNull();
    expect(data.result.lidar_points).toEqual([]);
    expect(data.result.satellite_images.nisar).toBeNull();
  });
  it('requires a usable name and integer fire year', () => {
    expect(() => mockUploadResult({ ...upload, name: ' ' })).toThrow('name');
    for (const fireYear of [1899, 2027, 2002.5, NaN])
      expect(() => mockUploadResult({ ...upload, fireYear })).toThrow('year');
  });
});

describe('mock analysis lifecycle', () => {
  it('opens an existing 2026 export unchanged and propagates the abort signal', async () => {
    vi.useFakeTimers();
    const data = catalogData();
    const loadFire = vi.fn(async () => data);
    const onStep = vi.fn();
    const signal = new AbortController().signal;
    const pending = runMockAnalysis(
      { kind: 'catalog', fireId: data.result.fire.id },
      { loadFire, onStep, signal },
    );
    await vi.runAllTimersAsync();
    expect(await pending).toBe(data);
    expect(loadFire).toHaveBeenCalledWith(data.result.fire.id, signal);
    expect(onStep.mock.calls.map((c) => c[0])).toEqual([0, 1, 2]);
  });
  it('builds an uploaded mock without requesting a catalog result', async () => {
    vi.useFakeTimers();
    const loadFire = vi.fn();
    const pending = runMockAnalysis(upload, {
      loadFire,
      onStep: vi.fn(),
      signal: new AbortController().signal,
    });
    await vi.runAllTimersAsync();
    expect((await pending).result.fire.name.en).toBe('My test fire');
    expect(loadFire).not.toHaveBeenCalled();
  });
  it('cancels before completing and never starts the data request', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const loadFire = vi.fn();
    const pending = runMockAnalysis(
      { kind: 'catalog', fireId: 'x' },
      { loadFire, onStep: vi.fn(), signal: controller.signal },
    );
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();
    await vi.runAllTimersAsync();
    await rejected;
    expect(loadFire).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('does not publish a late result from a loader that ignores cancellation', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const onStep = vi.fn();
    const pending = runMockAnalysis(
      { kind: 'catalog', fireId: 'x' },
      {
        onStep,
        signal: controller.signal,
        loadFire: async () => {
          controller.abort();
          return catalogData();
        },
      },
    );
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    await vi.runAllTimersAsync();
    await rejected;
    expect(onStep.mock.calls.map((c) => c[0])).toEqual([0, 1]);
  });
  it.each(['missing', 'wrong-summer', 'network'])(
    'reports a failed request (%s) so the caller can retry',
    async (problem) => {
      vi.useFakeTimers();
      const data = catalogData();
      data.result.satellite_images.summer = 2025;
      const pending = runMockAnalysis(
        { kind: 'catalog', fireId: 'x' },
        {
          onStep: vi.fn(),
          signal: new AbortController().signal,
          loadFire: async () => {
            if (problem === 'network') throw new Error('Connection failed');
            return problem === 'missing' ? null : data;
          },
        },
      );
      const rejected = expect(pending).rejects.toThrow();
      await vi.runAllTimersAsync();
      await rejected;
    },
  );
});
