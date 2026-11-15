import { describe, expect, it } from 'vitest';
import { FireGridSchema, FireIndexSchema, FireResultSchema, parseFireCells } from './fireSchema';
import { warningText } from './fireWarnings';
import { describeCell, cellClass } from '@/domain/fire/fireGrid';

const grid = {
  columns: 2,
  rows: 1,
  cell_size_m: 90,
  corners_lonlat: [
    [-120.24, 51.17],
    [-120.16, 51.17],
    [-120.16, 51.12],
    [-120.24, 51.12],
  ],
};
const result = {
  schema_version: 1,
  fire: {
    id: 'test',
    name: { en: 'Test', uk: 'Тест' },
    year: 2003,
    area_ha: 3100,
    perimeter: { type: 'Polygon', coordinates: [[...grid.corners_lonlat, grid.corners_lonlat[0]]] },
  },
  satellite_images: { summer: 2026 },
  map_grid: grid,
  neighbour_forest: { height_m: 19.1, source: 'gedi' },
  model_result: { recovery_today_avg: 0.36, area_recovered_80pct: 0 },
  growth_forecast: null,
  comparison: { optics: 0.95, model: 0.36, lidar: null, lidar_points_in_fire: 0 },
  lidar_points: [],
  warnings: [],
  files: { cells: 'cells.json', optical_image: null },
};
const parsed = FireResultSchema.parse(result);
describe('backend e352076 export contract', () => {
  it('accepts the minimal nested result used by backend exporter tests', () => {
    expect(parsed.model_result.stage_share).toBeNull();
    expect(parsed.model_result.error_vs_lidar_pct).toBeNull();
    expect(parsed.model_result.model_version).toBe('Not supplied');
    expect(parsed.model_result.area_recovered_80pct).toBe(0);
  });
  it('accepts all seven layers without changing values', () => {
    const cells = {
      model: { stage: [0, null], p_forest_gt5: [20, null], recovery: [0, null] },
      map: { zone: [1, 0], confidence: [null, null], reburn_year: [null, null] },
      optics: { ndvi: [-20, null] },
    };
    expect(parseFireCells(cells, parsed.map_grid)).toEqual(cells);
  });
  it('fills omitted layers and groups with independent full-length null arrays', () => {
    const cells = parseFireCells({ map: { zone: [1, 0] } }, parsed.map_grid);
    expect(cells.model.stage).toEqual([null, null]);
    expect(cells.optics.ndvi).toEqual([null, null]);
    expect(cells.model.stage).not.toBe(cells.model.recovery);
    expect(parseFireCells({}, parsed.map_grid).map.zone).toEqual([null, null]);
  });
  it('preserves explicit null cells and rejects null arrays or malformed values', () => {
    expect(parseFireCells({ model: { stage: [null, 0] } }, parsed.map_grid).model.stage).toEqual([
      null,
      0,
    ]);
    for (const input of [
      { model: { stage: null } },
      { model: { stage: [3, null] } },
      { map: { zone: [2, null] } },
      { optics: { ndvi: ['bad', null] } },
    ])
      expect(() => parseFireCells(input, parsed.map_grid)).toThrow();
  });
  it('rejects truncated arrays and invalid grid geometry', () => {
    expect(() => parseFireCells({ model: { stage: [0] } }, parsed.map_grid)).toThrow();
    for (const corners of [
      [...grid.corners_lonlat].fill(grid.corners_lonlat[0]!),
      [
        grid.corners_lonlat[0],
        grid.corners_lonlat[2],
        grid.corners_lonlat[1],
        grid.corners_lonlat[3],
      ],
    ])
      expect(FireGridSchema.safeParse({ ...grid, corners_lonlat: corners }).success).toBe(false);
    expect(FireGridSchema.safeParse({ ...grid, rows: 0 }).success).toBe(false);
  });
  it('rejects missing required fields and supports optional optical metadata', () => {
    const { warnings: ignored, ...missing } = result;
    void ignored;
    expect(FireResultSchema.safeParse(missing).success).toBe(false);
    expect(FireResultSchema.safeParse({ ...result, files: {} }).success).toBe(false);
    expect(
      FireResultSchema.parse({
        ...result,
        files: { cells: 'cells.json', optical_image: 'optical.png' },
      }).files.optical_image,
    ).toBe('optical.png');
    expect(FireIndexSchema.safeParse([{ id: 'test' }]).success).toBe(false);
  });
  it('uses zone codes only for burn/reference and does not mask predictions using confidence', () => {
    const cells = parseFireCells(
      { model: { stage: [2, 1] }, map: { zone: [1, 0], confidence: [0, 2] } },
      parsed.map_grid,
    );
    const data = { result: parsed, cells, opticalImageUrl: null };
    expect(describeCell(data, 'stage', 0).area).toBe('Burned area');
    expect(describeCell(data, 'stage', 1).area).toBe('Neighbouring forest (reference)');
    expect(cellClass(cells, 'stage', 0)).toBe(2);
  });
  it('explains all standard covariate defaults and preserves unknown warning codes', () => {
    for (const name of [
      'DNBR',
      'NBR_PRE',
      'ELEV',
      'SLOPE',
      'SOIL_CLAY',
      'SOIL_SAND',
      'SOIL_ORG_C',
      'DIST_EDGE_M',
    ])
      expect(warningText(`DEFAULT_${name}`)).toContain('Canada mean');
    expect(warningText('LOW_NISAR_COVERAGE')).toContain('less than 80%');
    expect(warningText('FUTURE_UNKNOWN')).toContain('future unknown');
  });
});
