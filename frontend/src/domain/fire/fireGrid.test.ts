import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  FireCellsSchema,
  FireIndexSchema,
  FireResultSchema,
  type FireCells,
  type FireData,
  type FireResult,
} from '@/data/fireSchema';
import { DEVELOPMENT_FIXTURE } from '@/data/fireWarnings';
import {
  categorySummary,
  cellAt,
  cellCentre,
  cellRing,
  nextSuppliedCell,
  cellClass,
  describeCell,
  gediBand,
  GRID_LAYERS,
  gridBounds,
  gridVertex,
  layerCoverage,
  layerPixels,
  overlayAvailability,
  parseHex,
  probabilityBand,
  zoneOutline,
  zonePixels,
} from './fireGrid';

const DEMO = resolve(import.meta.dirname, '../../../public/data/demo');
const json = (path: string): unknown => JSON.parse(readFileSync(resolve(DEMO, path), 'utf8'));

/** A 3 × 2 grid: row 0 = burned, burned, reference; row 1 = reference, missing, outside. */
function tiny(): FireData {
  const result: FireResult = {
    schema_version: 1,
    fire: { id: 't', name: { en: 'T', uk: '' }, year: 2000, area_ha: null, perimeter: null },
    satellite_images: { summer: 2026 },
    map_grid: {
      columns: 3,
      rows: 2,
      cell_size_m: 360,
      corners_lonlat: [
        [-121, 52],
        [-120, 52],
        [-120, 51],
        [-121, 51],
      ],
    },
    neighbour_forest: null,
    model_result: {
      model_version: 'x',
      region: 'x',
      recovery_today_avg: null,
      area_recovered_80pct: null,
      stage_share: null,
      error_vs_lidar_pct: null,
      excluded_share: null,
      accuracy: null,
    },
    lidar_points: [],
    files: { cells: 'cells.json' },
    warnings: [],
  };
  const cells: FireCells = {
    model: {
      stage: [0, 2, 1, 1, null, 2],
      p_forest_gt5: [12, 95, 55, null, null, 88],
      recovery: [10, 90, 50, 40, null, 80],
    },
    map: {
      zone: [1, 1, 0, 0, null, 1],
      confidence: [2, 2, 2, 1, null, 0],
      reburn_year: [null, 2017, null, null, null, null],
    },
    optics: { ndvi: [null, null, null, null, null, null] },
  };
  return { result, cells, opticalImageUrl: null };
}

describe('categorical layers', () => {
  it('bins probability above 5 m at the stated breaks', () => {
    expect([0, 39, 40, 69, 70, 100].map(probabilityBand)).toEqual([0, 0, 1, 1, 2, 2]);
  });

  it('keeps missing values missing without interpreting undefined confidence codes', () => {
    const { cells } = tiny();
    expect([0, 1, 2, 3, 4, 5].map((i) => cellClass(cells, 'stage', i))).toEqual([
      0,
      2,
      1,
      1,
      null,
      2,
    ]);
    expect([0, 1, 2, 3, 4, 5].map((i) => cellClass(cells, 'probability', i))).toEqual([
      0,
      2,
      1,
      null,
      null,
      2,
    ]);
    expect(layerCoverage(cells, 'probability')).toEqual({ valued: 4, outside: 0, total: 6 });
  });

  it('draws one transparent pixel for every cell without a class', () => {
    const { cells } = tiny();
    const red: [number, number, number] = [255, 0, 0];
    const px = layerPixels(cells, 'probability', {
      categories: [red, [0, 255, 0], [0, 0, 255]],
      outside: [9, 9, 9],
    });
    expect(px).toHaveLength(6 * 4);
    expect(Array.from(px.slice(0, 4))).toEqual([255, 0, 0, 255]);
    expect(Array.from(px.slice(12, 16))).toEqual([0, 0, 0, 0]); // supplied stage, no probability
    expect(Array.from(px.slice(16, 20))).toEqual([0, 0, 0, 0]); // entirely missing
    expect(Array.from(px.slice(20, 24))).toEqual([0, 0, 255, 255]);
    const zone = zonePixels(cells, [1, 2, 3], 50);
    expect([0, 1, 2, 3, 4, 5].map((i) => zone[i * 4 + 3])).toEqual([0, 0, 50, 50, 0, 0]);
  });
});

describe('cell descriptions', () => {
  it('describe categories only, never the cell numbers', () => {
    const data = tiny();
    const text = JSON.stringify(
      [0, 1, 2, 3, 4, 5].flatMap((i) => [
        describeCell(data, 'stage', i),
        describeCell(data, 'probability', i),
      ]),
    );
    // Recovery and probability values of the tiny grid must not leak into descriptions
    // (values that coincide with band labels such as "5–10 m" or "40–70%" are skipped).
    for (const n of ['12', '95', '55', '88', '90', '50', '80'])
      expect(text).not.toMatch(new RegExp(`(^|\\D)${n}(%|\\D|$)`));
    expect(describeCell(data, 'probability', 1)).toMatchObject({
      row: 1,
      column: 2,
      area: 'Burned area',
      value: 'High',
      reburnYear: 2017,
    });
  });

  it('separates missing, unassessed and outside-domain cells', () => {
    const data = tiny();
    expect(describeCell(data, 'stage', 4).supplied).toBe(false);
    expect(describeCell(data, 'probability', 3).value).toBe('No value supplied (not interpolated)');
    expect(describeCell(data, 'stage', 5).value).toBe('Above 10 m');
    expect(describeCell(data, 'stage', 2).area).toBe('Neighbouring forest (reference)');
    expect(describeCell(data, 'stage', 3).domain).toBe(
      'Pipeline confidence code 1 (meaning not defined by backend)',
    );
  });

  it('labels the probability layer as model output, not the geographic domain', () => {
    expect(GRID_LAYERS.probability.description).toMatch(/relative score/i);
    expect(GRID_LAYERS.probability.description).toMatch(/not a calibrated probability/i);
    expect(GRID_LAYERS.probability.categories.join()).not.toMatch(/%/);
    expect(GRID_LAYERS.probability.description).not.toMatch(/confidence|domain/i);
  });

  it('describes GEDI footprints by stage band', () => {
    expect([4.9, 5, 10, 10.1].map(gediBand)).toEqual([
      'Below 5 m',
      '5–10 m',
      '5–10 m',
      'Above 10 m',
    ]);
  });
});

describe('keyboard inspection helpers', () => {
  it('steps through supplied cells only, wrapping in both directions', () => {
    const { cells } = tiny(); // cell 4 has no field at all
    expect(nextSuppliedCell(cells, -1, 1)).toBe(0);
    expect(nextSuppliedCell(cells, 3, 1)).toBe(5);
    expect(nextSuppliedCell(cells, 5, 1)).toBe(0);
    expect(nextSuppliedCell(cells, 5, -1)).toBe(3);
    expect(nextSuppliedCell(cells, 0, -1)).toBe(5);
    expect(
      nextSuppliedCell(
        {
          model: { stage: [null, null], p_forest_gt5: [null, null], recovery: [null, null] },
          map: { zone: [null, null], confidence: [null, null], reburn_year: [null, null] },
          optics: { ndvi: [null, null] },
        },
        0,
        1,
      ),
    ).toBeNull();
  });

  it('summarises cells per category and area as counts', () => {
    const rows = categorySummary(tiny().cells, 'probability');
    expect(rows.map((r) => [r.label, r.counts])).toEqual([
      ['Low', { burned: 1, reference: 0, other: 0 }],
      ['Medium', { burned: 0, reference: 1, other: 0 }],
      ['High', { burned: 2, reference: 0, other: 0 }],
      ['Outside the model’s domain', { burned: 0, reference: 0, other: 0 }],
      ['No value supplied', { burned: 0, reference: 1, other: 0 }],
    ]);
  });

  it('outlines and centres a cell on the drawn grid', () => {
    const grid = tiny().result.map_grid;
    const ring = cellRing(grid, 4);
    expect(ring).toHaveLength(5);
    expect(ring[0]).toEqual(ring[4]);
    expect(cellAt(grid, cellCentre(grid, 4))).toBe(4);
  });
});

describe('grid geometry', () => {
  it('finds the cell under a position and nothing outside the grid', () => {
    const { result } = tiny();
    const grid = result.map_grid;
    const centre = (c: number, r: number) => gridVertex(grid, c + 0.5, r + 0.5);
    for (let r = 0; r < 2; r++)
      for (let c = 0; c < 3; c++) expect(cellAt(grid, centre(c, r))).toBe(r * 3 + c);
    expect(cellAt(grid, [-122, 51.5])).toBeNull();
    expect(cellAt(grid, [-120.5, 52.5])).toBeNull();
    expect(gridBounds(grid)).toEqual([
      [-121, 51],
      [-120, 52],
    ]);
  });

  it('round-trips vertices of a rotated grid through the inverse lookup', () => {
    const grid = {
      columns: 10,
      rows: 8,
      cell_size_m: 360,
      corners_lonlat: [
        [-75.2, 50.1],
        [-74.7, 50.2],
        [-74.6, 49.8],
        [-75.15, 49.7],
      ],
    } as FireResult['map_grid'];
    for (const [c, r] of [
      [0, 0],
      [9, 7],
      [4, 3],
      [7, 1],
    ] as const)
      expect(cellAt(grid, gridVertex(grid, c + 0.5, r + 0.5))).toBe(r * 10 + c);
  });

  it('outlines the neighbouring-forest zone along cell edges', () => {
    // Reference cells (2 and 3) are not adjacent: each has four boundary edges.
    expect(zoneOutline(tiny())).toHaveLength(8);
  });

  it('parses theme colours with a fallback', () => {
    expect(parseHex('#26a69a')).toEqual([38, 166, 154]);
    expect(parseHex('#fff')).toEqual([255, 255, 255]);
    expect(parseHex('rgb(1 2 3)', [1, 1, 1])).toEqual([1, 1, 1]);
  });
});

describe('bundled example catalogue', () => {
  const index = FireIndexSchema.parse(json('index.json'));

  it('lists the four required fires, each with a loadable result and cells', () => {
    expect(
      index.map((f) => `${f.name.en.replace(/ \(dev fixture\)$/, '')} ${f.year}`).sort(),
    ).toEqual(['British Columbia 2003', 'Ontario 1988', 'Quebec 1995', 'Quebec 2010']);
    for (const entry of index) {
      const result = FireResultSchema.parse(json(entry.result));
      const cells = FireCellsSchema.parse(
        json(resolve(DEMO, entry.result, '..', result.files.cells)),
      );
      expect(cells.model.stage).toHaveLength(result.map_grid.columns * result.map_grid.rows);
    }
  });

  it('labels every development fixture and gives it no measurements or model results', () => {
    const fixtures = index.filter((f) => f.id.endsWith('_fixture'));
    expect(fixtures).toHaveLength(3);
    for (const entry of fixtures) {
      expect(entry.name.en).toMatch(/dev fixture/);
      expect([
        entry.recovery_today_avg,
        entry.area_recovered_80pct,
        entry.year_80pct,
        entry.area_ha,
      ]).toEqual([null, null, null, null]);
      const result = FireResultSchema.parse(json(entry.result));
      const cells = FireCellsSchema.parse(json(resolve(DEMO, entry.result, '..', 'cells.json')));
      expect(result.warnings).toContain(DEVELOPMENT_FIXTURE);
      expect(result.lidar_points).toEqual([]);
      expect(result.neighbour_forest).toBeNull();
      expect(result.fire.perimeter).toBeNull();
      expect(Object.values(result.model_result).filter((v) => typeof v === 'number')).toEqual([]);
      expect(cells.model.recovery.every((v) => v === null)).toBe(true);
      expect(cells.optics.ndvi.every((v) => v === null)).toBe(true);
      expect(overlayAvailability({ result, cells, opticalImageUrl: null }).gedi).toBe(false);
    }
  });
});
