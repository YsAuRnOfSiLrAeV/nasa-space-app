/**
 * The fire grid as categories, geometry and pixels. DOM-free and MapLibre-free, so
 * every rule below is unit-tested in Node.
 *
 * Scientific rules (DELIVERABLES tab 1 and the Phase 2 brief):
 *  - Cells are shown only as categories. No per-cell numbers (heights, recovery or
 *    probabilities) leave this module; probabilities are binned for display.
 *  - A missing value stays missing: nothing is interpolated or filled.
 *  - `map.confidence` is the geographic domain where the model applies. It is a
 *    pipeline classification, never the model's probability, and is named so.
 *  - The grid shows the observation summer only: nothing here depends on a year.
 *
 * Geometry: the export supplies four lon/lat corners (TL, TR, BR, BL; row 0 at the
 * top). MapLibre stretches an image across those corners in Web Mercator, so cell
 * lookup interpolates in the same space and the tooltip names the cell that is drawn.
 */
import { SCORE_BANDS } from '@/data/calibrationEvidence';
import type { FireCells, FireData, FireResult } from '@/data/fireSchema';

export type GridLayerId = 'stage' | 'probability';
export type Category = 0 | 1 | 2;
/** What one cell shows on the active layer. */
export type CellClass = Category | 'outside' | null;

/**
 * Display bands for `p_forest_gt5` (percent): Low / Medium / High. The calibration
 * study found the score ranks well but is not a calibrated probability, so no
 * percentage is ever shown. Thresholds are provisional and live in one place.
 */
export const PROBABILITY_BREAKS = SCORE_BANDS.breaks;

export interface GridLayerSpec {
  id: GridLayerId;
  label: string;
  /** What the layer is, in one line, shown above its legend. */
  description: string;
  categories: readonly [string, string, string];
  /** Theme custom properties for each category (with fallbacks below). */
  tokens: readonly [string, string, string];
}

export const GRID_LAYERS: Record<GridLayerId, GridLayerSpec> = {
  stage: {
    id: 'stage',
    label: 'Forest stage',
    description: 'Model height stage of the forest canopy in each grid cell.',
    categories: ['Below 5 m', '5–10 m', 'Above 10 m'],
    tokens: ['--grid-stage-0', '--grid-stage-1', '--grid-stage-2'],
  },
  probability: {
    id: 'probability',
    label: 'Relative forest score',
    description:
      'The model’s relative score that a cell holds forest taller than 5 m, in three provisional bands. It ranks cells; it is not a calibrated probability.',
    categories: SCORE_BANDS.labels,
    tokens: ['--grid-prob-0', '--grid-prob-1', '--grid-prob-2'],
  },
};

export const GRID_LAYER_IDS = Object.keys(GRID_LAYERS) as GridLayerId[];

/** Fallback colours, matching the Earth Intelligence tokens. */
export const GRID_FALLBACK_COLORS: Record<string, string> = {
  '--grid-stage-0': '#5c6bc0',
  '--grid-stage-1': '#26a69a',
  '--grid-stage-2': '#d4e157',
  '--grid-prob-0': '#3d6fa8',
  '--grid-prob-1': '#6aa8dc',
  '--grid-prob-2': '#c4e3fb',
  '--grid-outside': '#6b6b6b',
  '--grid-zone': '#f3f0ea',
};

export const DOMAIN_NAMES = [
  'Outside the model’s geographic domain',
  'Inside the domain: current state only',
  'Inside the domain: current state and forecast',
] as const;

export const ZONE_NAMES = { 1: 'Burned area', 0: 'Neighbouring forest (reference)' } as const;

export function probabilityBand(percent: number): Category {
  return percent < PROBABILITY_BREAKS[0] ? 0 : percent < PROBABILITY_BREAKS[1] ? 1 : 2;
}

/** The category of one cell on a layer, or null when the export supplies no value. */
export function categoryAt(cells: FireCells, layer: GridLayerId, index: number): Category | null {
  if (layer === 'stage') return cells.model.stage[index] ?? null;
  const p = cells.model.p_forest_gt5[index];
  return p == null ? null : probabilityBand(p);
}

/** Outside the domain overrides the value: such cells carry no estimate (DELIVERABLES tab 8). */
export function cellClass(cells: FireCells, layer: GridLayerId, index: number): CellClass {
  if (cells.map.confidence[index] === 0) return 'outside';
  return categoryAt(cells, layer, index);
}

export interface LayerCoverage {
  /** Cells with a category on this layer. */
  valued: number;
  /** Cells outside the model's geographic domain. */
  outside: number;
  total: number;
}

export function layerCoverage(cells: FireCells, layer: GridLayerId): LayerCoverage {
  const total = cells.model.stage.length;
  let valued = 0;
  let outside = 0;
  for (let i = 0; i < total; i++) {
    const c = cellClass(cells, layer, i);
    if (c === 'outside') outside++;
    else if (c !== null) valued++;
  }
  return { valued, outside, total };
}

/** Which overlays the export can actually support. */
export interface OverlayAvailability {
  perimeter: boolean;
  zone: boolean;
  gedi: boolean;
  optical: boolean;
}

export function overlayAvailability(data: FireData): OverlayAvailability {
  return {
    perimeter: data.result.fire.perimeter !== null,
    zone: data.cells.map.zone.some((z) => z === 0),
    gedi: data.result.lidar_points.length > 0,
    optical: data.opticalImageUrl !== null,
  };
}

// ── Categorical cell description (the tooltip) ──────────────────────────────

export interface CellDescription {
  index: number;
  /** One-based, for people. */
  row: number;
  column: number;
  /** False when the export has no field at all for this cell. */
  supplied: boolean;
  area: string;
  layerLabel: string;
  /** The category name, or a missing-value phrase. Never a number from the cell. */
  value: string;
  domain: string | null;
  reburnYear: number | null;
}

export function describeCell(data: FireData, layer: GridLayerId, index: number): CellDescription {
  const { cells, result } = data;
  const columns = result.map_grid.columns;
  const supplied = isSupplied(cells, index);
  const zone = cells.map.zone[index];
  const confidence = cells.map.confidence[index];
  const cls = cellClass(cells, layer, index);
  const spec = GRID_LAYERS[layer];
  return {
    index,
    row: Math.floor(index / columns) + 1,
    column: (index % columns) + 1,
    supplied,
    area: zone == null ? 'Not assessed (outside burned area and reference ring)' : ZONE_NAMES[zone],
    layerLabel: spec.label,
    value:
      cls === 'outside'
        ? 'No estimate (outside the model’s domain)'
        : cls === null
          ? 'No value supplied (not interpolated)'
          : spec.categories[cls],
    domain: confidence == null ? null : DOMAIN_NAMES[confidence],
    reburnYear: cells.map.reburn_year[index] ?? null,
  };
}

/** True when the export supplies any field for the cell. */
export function isSupplied(cells: FireCells, index: number): boolean {
  return Object.values(cells).some((section) =>
    Object.values(section).some((values) => values[index] !== null),
  );
}

/** The next (or previous) cell with any supplied field, wrapping around; null when none. */
export function nextSuppliedCell(cells: FireCells, from: number, step: 1 | -1): number | null {
  const n = cells.model.stage.length;
  for (let k = 1; k <= n; k++) {
    const i = (((from + step * k) % n) + n) % n;
    if (isSupplied(cells, i)) return i;
  }
  return null;
}

export type SummaryArea = 'burned' | 'reference' | 'other';
export interface SummaryRow {
  label: string;
  /** Theme token for a swatch, or null for rows without one. */
  token: string | null;
  counts: Record<SummaryArea, number>;
}

/**
 * Cell counts per category of the active layer and per area: the accessible text
 * equivalent of the map. Counts only; no cell value is reported.
 */
export function categorySummary(cells: FireCells, layer: GridLayerId): SummaryRow[] {
  const spec = GRID_LAYERS[layer];
  const empty = (): Record<SummaryArea, number> => ({ burned: 0, reference: 0, other: 0 });
  const rows: SummaryRow[] = [
    ...spec.categories.map((label, i) => ({ label, token: spec.tokens[i]!, counts: empty() })),
    { label: 'Outside the model’s domain', token: '--grid-outside', counts: empty() },
    { label: 'No value supplied', token: null, counts: empty() },
  ];
  for (let i = 0; i < cells.model.stage.length; i++) {
    if (!isSupplied(cells, i)) continue;
    const zone = cells.map.zone[i];
    const area: SummaryArea = zone === 1 ? 'burned' : zone === 0 ? 'reference' : 'other';
    const cls = cellClass(cells, layer, i);
    const row = cls === 'outside' ? rows[3]! : cls === null ? rows[4]! : rows[cls]!;
    row.counts[area]++;
  }
  return rows;
}

/** GEDI footprints are described by the same stage bands as the grid, never as a number. */
export function gediBand(heightM: number): string {
  return GRID_LAYERS.stage.categories[heightM < 5 ? 0 : heightM <= 10 ? 1 : 2];
}

// ── Geometry ────────────────────────────────────────────────────────────────

type Grid = FireResult['map_grid'];
type XY = [number, number];

const toMercator = ([lon, lat]: XY): XY => [
  (lon + 180) / 360,
  (180 - (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))) / 360,
];
const fromMercator = ([x, y]: XY): XY => [
  x * 360 - 180,
  (360 / Math.PI) * Math.atan(Math.exp(((180 - y * 360) * Math.PI) / 180)) - 90,
];

/** A grid vertex (column, row may be fractional) as lon/lat, as MapLibre draws it. */
export function gridVertex(grid: Grid, column: number, row: number): XY {
  const [tl, tr, br, bl] = grid.corners_lonlat.map(toMercator) as [XY, XY, XY, XY];
  const u = column / grid.columns;
  const v = row / grid.rows;
  const at = (axis: 0 | 1) =>
    (1 - v) * ((1 - u) * tl[axis] + u * tr[axis]) + v * ((1 - u) * bl[axis] + u * br[axis]);
  return fromMercator([at(0), at(1)]);
}

const cross = (a: XY, b: XY) => a[0] * b[1] - a[1] * b[0];

/**
 * The cell under a lon/lat position, or null outside the grid. Inverse bilinear
 * interpolation in Mercator space (exact for any convex quadrilateral).
 */
export function cellAt(grid: Grid, lngLat: XY): number | null {
  const [a, b, c, d] = grid.corners_lonlat.map(toMercator) as [XY, XY, XY, XY];
  const p = toMercator(lngLat);
  const e: XY = [b[0] - a[0], b[1] - a[1]];
  const f: XY = [d[0] - a[0], d[1] - a[1]];
  const g: XY = [a[0] - b[0] + c[0] - d[0], a[1] - b[1] + c[1] - d[1]];
  const h: XY = [p[0] - a[0], p[1] - a[1]];
  const k2 = cross(g, f);
  const k1 = cross(e, f) + cross(h, g);
  const k0 = cross(h, e);
  const scale = Math.abs(cross(e, f)) || 1;
  let v: number;
  if (Math.abs(k2) < 1e-12 * scale) {
    if (k1 === 0) return null;
    v = -k0 / k1;
  } else {
    const w = k1 * k1 - 4 * k0 * k2;
    if (w < 0) return null;
    const root = Math.sqrt(w);
    const v1 = (-k1 - root) / (2 * k2);
    const v2 = (-k1 + root) / (2 * k2);
    v = v1 >= 0 && v1 <= 1 ? v1 : v2;
  }
  const denX = e[0] + g[0] * v;
  const denY = e[1] + g[1] * v;
  const u = Math.abs(denX) >= Math.abs(denY) ? (h[0] - f[0] * v) / denX : (h[1] - f[1] * v) / denY;
  if (!(u >= 0 && u < 1 && v >= 0 && v < 1)) return null;
  const column = Math.min(grid.columns - 1, Math.floor(u * grid.columns));
  const row = Math.min(grid.rows - 1, Math.floor(v * grid.rows));
  return row * grid.columns + column;
}

/** The four corners of one cell, closed, as lon/lat. */
export function cellRing(grid: Grid, index: number): XY[] {
  const column = index % grid.columns;
  const row = Math.floor(index / grid.columns);
  const v = (c: number, r: number) => gridVertex(grid, c, r);
  return [
    v(column, row),
    v(column + 1, row),
    v(column + 1, row + 1),
    v(column, row + 1),
    v(column, row),
  ];
}

export function cellCentre(grid: Grid, index: number): XY {
  return gridVertex(grid, (index % grid.columns) + 0.5, Math.floor(index / grid.columns) + 0.5);
}

/** [[west, south], [east, north]] of the grid. */
export function gridBounds(grid: Grid): [XY, XY] {
  const lons = grid.corners_lonlat.map(([lon]) => lon);
  const lats = grid.corners_lonlat.map(([, lat]) => lat);
  return [
    [Math.min(...lons), Math.min(...lats)],
    [Math.max(...lons), Math.max(...lats)],
  ];
}

/**
 * Boundary of the neighbouring-forest zone (zone 0) as cell-edge segments: an
 * edge is drawn wherever a reference cell meets a non-reference cell or the grid edge.
 */
export function zoneOutline(data: FireData): XY[][] {
  const grid = data.result.map_grid;
  const zone = data.cells.map.zone;
  const { columns, rows } = grid;
  const isRef = (c: number, r: number) =>
    c >= 0 && r >= 0 && c < columns && r < rows && zone[r * columns + c] === 0;
  const segments: XY[][] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      if (!isRef(c, r)) continue;
      if (!isRef(c, r - 1)) segments.push([gridVertex(grid, c, r), gridVertex(grid, c + 1, r)]);
      if (!isRef(c, r + 1))
        segments.push([gridVertex(grid, c, r + 1), gridVertex(grid, c + 1, r + 1)]);
      if (!isRef(c - 1, r)) segments.push([gridVertex(grid, c, r), gridVertex(grid, c, r + 1)]);
      if (!isRef(c + 1, r))
        segments.push([gridVertex(grid, c + 1, r), gridVertex(grid, c + 1, r + 1)]);
    }
  }
  return segments;
}

// ── Pixels (one per cell; the browser turns them into a texture) ────────────

export type RGB = [number, number, number];

export function parseHex(color: string, fallback: RGB = [128, 128, 128]): RGB {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return fallback;
  const hex =
    m[1]!.length === 3
      ? m[1]!
          .split('')
          .map((ch) => ch + ch)
          .join('')
      : m[1]!;
  return [0, 2, 4].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)) as RGB;
}

export interface GridPalette {
  categories: [RGB, RGB, RGB];
  outside: RGB;
}

/** RGBA, row-major from the top-left cell; transparent where the cell has no class. */
export function layerPixels(
  cells: FireCells,
  layer: GridLayerId,
  palette: GridPalette,
): Uint8ClampedArray {
  const n = cells.model.stage.length;
  const out = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) {
    const cls = cellClass(cells, layer, i);
    if (cls === null) continue;
    const rgb = cls === 'outside' ? palette.outside : palette.categories[cls];
    out.set([rgb[0], rgb[1], rgb[2], 255], i * 4);
  }
  return out;
}

/** A light wash over neighbouring-forest cells, under the zone outline. */
export function zonePixels(cells: FireCells, rgb: RGB, alpha = 56): Uint8ClampedArray {
  const n = cells.map.zone.length;
  const out = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) {
    if (cells.map.zone[i] === 0) out.set([rgb[0], rgb[1], rgb[2], alpha], i * 4);
  }
  return out;
}
