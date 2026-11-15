/**
 * Development fixtures for the three example fires whose team exports have not
 * arrived yet: `npm run data:fixtures` (writes) and `--check` (verifies, writes nothing).
 *
 * What a fixture is, and is not:
 *  - It follows the existing index/result/cells contract exactly, so the Map
 *    exercises the same loader and renderer a real export will use.
 *  - Every result carries the `DEVELOPMENT_FIXTURE` warning, and every name says
 *    "dev fixture", so the interface labels it wherever it appears.
 *  - The location is a placeholder inside the named province, not the fire's
 *    real position, and no perimeter is supplied.
 *  - Cell values are deliberately geometric (rings, a straight gradient, a block of
 *    missing cells) so they cannot be mistaken for observations. Recovery, NDVI,
 *    reburn years, GEDI points, summaries and satellite acquisitions are all absent.
 *
 * Fixtures live only in the bundled example folder (public/data/demo). Once the
 * pipeline writes ../data/demo/index.json, the team folder replaces that folder
 * entirely, fixtures included (scripts/demoData.ts).
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { z } from 'zod';
import {
  FireCellsSchema,
  FireIndexSchema,
  FireResultSchema,
  validateFireCells,
  type DemoFire,
  type FireCells,
  type FireResult,
} from '../src/data/fireSchema';
import { DEVELOPMENT_FIXTURE } from '../src/data/fireWarnings';
import { EXAMPLE_DEMO_DIR } from './demoData';

interface FixtureSpec {
  id: string;
  province: string;
  year: number;
  /** Placeholder position inside the province (not the fire's location). */
  center: [number, number];
  columns: number;
  rows: number;
  /** Which situations this fixture exercises in the interface. */
  variant: 'complete' | 'partial-domain' | 'stage-only';
}

const CELL_SIZE_M = 360;
const SUMMER = 2026;

export const FIXTURES: FixtureSpec[] = [
  {
    id: 'quebec_1995_fixture',
    province: 'Quebec',
    year: 1995,
    center: [-77.8, 48.6],
    columns: 64,
    rows: 56,
    variant: 'complete',
  },
  {
    id: 'quebec_2010_fixture',
    province: 'Quebec',
    year: 2010,
    center: [-70.0, 51.3],
    columns: 60,
    rows: 60,
    variant: 'partial-domain',
  },
  {
    id: 'ontario_1988_fixture',
    province: 'Ontario',
    year: 1988,
    center: [-87.5, 50.6],
    columns: 56,
    rows: 52,
    variant: 'stage-only',
  },
];

const round = (value: number) => Math.round(value * 1e5) / 1e5;

function corners(spec: FixtureSpec): FireResult['map_grid']['corners_lonlat'] {
  const [lon, lat] = spec.center;
  const halfLon = (spec.columns * CELL_SIZE_M) / 2 / (111_320 * Math.cos((lat * Math.PI) / 180));
  const halfLat = (spec.rows * CELL_SIZE_M) / 2 / 110_574;
  const w = round(lon - halfLon);
  const e = round(lon + halfLon);
  const n = round(lat + halfLat);
  const s = round(lat - halfLat);
  return [
    [w, n],
    [e, n],
    [e, s],
    [w, s],
  ];
}

/** Geometric test patterns; see the file comment for why they look artificial. */
function cells(spec: FixtureSpec): FireCells {
  const { columns, rows, variant } = spec;
  const n = columns * rows;
  const nulls = () => Array.from({ length: n }, () => null);
  const stage: FireCells['model']['stage'] = nulls();
  const probability: (number | null)[] = nulls();
  const zone: FireCells['map']['zone'] = nulls();
  const confidence: FireCells['map']['confidence'] = nulls();
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const i = row * columns + column;
      const dx = (column + 0.5 - columns / 2) / (columns * 0.3);
      const dy = (row + 0.5 - rows / 2) / (rows * 0.28);
      const r = Math.hypot(dx, dy);
      if (r > 1.5) continue;
      const burned = r <= 1;
      // A rectangular block of entirely missing cells: never filled or interpolated.
      if (
        variant === 'complete' &&
        column >= columns * 0.55 &&
        column < columns * 0.7 &&
        row >= rows * 0.3 &&
        row < rows * 0.45
      )
        continue;
      if (variant === 'stage-only') {
        stage[i] = r < 0.45 ? 0 : r < 0.8 ? 1 : 2;
        confidence[i] = 2;
        continue;
      }
      zone[i] = burned ? 1 : 0;
      stage[i] = burned ? (r < 0.45 ? 0 : r < 0.8 ? 1 : 2) : 2;
      probability[i] = Math.round(8 + (84 * column) / (columns - 1));
      const fromEast = (columns - 1 - column) / columns;
      confidence[i] =
        variant === 'partial-domain' && fromEast < 0.18 ? (fromEast < 0.09 ? 0 : 1) : 2;
    }
  }
  return {
    model: { stage, p_forest_gt5: probability, recovery: nulls() },
    map: { zone, confidence, reburn_year: nulls() },
    optics: { ndvi: nulls() },
  };
}

function build(spec: FixtureSpec) {
  const name = { en: `${spec.province} (dev fixture)`, uk: '' };
  const index: DemoFire = {
    id: spec.id,
    name,
    year: spec.year,
    area_ha: null,
    summer: SUMMER,
    center_lonlat: spec.center,
    recovery_today_avg: null,
    area_recovered_80pct: null,
    year_80pct: null,
    result: `${spec.id}/result.json`,
  };
  const result: z.input<typeof FireResultSchema> = {
    schema_version: 1,
    fire: { id: spec.id, name, year: spec.year, area_ha: null, perimeter: null },
    satellite_images: { summer: SUMMER },
    map_grid: {
      columns: spec.columns,
      rows: spec.rows,
      cell_size_m: CELL_SIZE_M,
      corners_lonlat: corners(spec),
    },
    neighbour_forest: null,
    model_result: {
      model_version: 'development fixture (no model)',
      region: 'not applicable',
      recovery_today_avg: null,
      area_recovered_80pct: null,
      stage_share: null,
      error_vs_lidar_pct: null,
    },
    lidar_points: [],
    files: { cells: 'cells.json', optical_image: null },
    warnings: [DEVELOPMENT_FIXTURE],
  };
  const grid = cells(spec);
  FireResultSchema.parse(result);
  FireCellsSchema.parse(grid);
  validateFireCells(grid, result.map_grid);
  return { index, result, cells: grid };
}

const pretty = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

function main() {
  const check = process.argv.includes('--check');
  const indexPath = join(EXAMPLE_DEMO_DIR, 'index.json');
  // Other entries are kept byte-for-byte as their owner wrote them (not re-serialised by zod).
  const raw = JSON.parse(readFileSync(indexPath, 'utf8')) as { id: string }[];
  FireIndexSchema.parse(raw);
  const built = FIXTURES.map(build);
  const fixtureIds = new Set(FIXTURES.map((f) => f.id));
  // The documentation example stays first; fixtures follow in a fixed order.
  const index = [...raw.filter((f) => !fixtureIds.has(f.id)), ...built.map((b) => b.index)];
  FireIndexSchema.parse(index);

  const files: [string, string][] = [[indexPath, pretty(index)]];
  for (const fixture of built) {
    const dir = join(EXAMPLE_DEMO_DIR, fixture.index.id);
    files.push([join(dir, 'result.json'), pretty(fixture.result)]);
    files.push([join(dir, 'cells.json'), `${JSON.stringify(fixture.cells)}\n`]);
  }

  const stale = files.filter(
    ([path, text]) => !existsSync(path) || readFileSync(path, 'utf8') !== text,
  );
  if (check) {
    if (stale.length) {
      console.error(
        `✖ ${stale.length} development fixture file(s) are out of date. Run \`npm run data:fixtures\`.`,
      );
      process.exit(1);
    }
    console.log(`✔ ${FIXTURES.length} development fixtures are up to date.`);
    return;
  }
  for (const [path, text] of stale) {
    mkdirSync(join(path, '..'), { recursive: true });
    writeFileSync(path, text);
  }
  console.log(
    `✔ ${FIXTURES.length} development fixtures (${stale.length} file(s) written) in ${EXAMPLE_DEMO_DIR}`,
  );
}

main();
