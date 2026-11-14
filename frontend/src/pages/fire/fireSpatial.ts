import type { FeatureCollection, Polygon } from 'geojson';
import type { FireData, FireResult } from '@/data/fireSchema';

/** Corners are supplied in TL, TR, BR, BL order. Row zero starts at the top. */
export function gridPosition(
  grid: FireResult['map_grid'],
  column: number,
  row: number,
): [number, number] {
  const [tl, tr, br, bl] = grid.corners_lonlat;
  const u = column / grid.columns;
  const v = row / grid.rows;
  return [0, 1].map(
    (axis) =>
      (1 - v) * ((1 - u) * tl[axis]! + u * tr[axis]!) + v * ((1 - u) * bl[axis]! + u * br[axis]!),
  ) as [number, number];
}

/** Include cells with any supplied value. Entirely absent cells stay empty. */
export function suppliedCellIds({ result, cells }: FireData): number[] {
  const arrays = Object.values(cells).flatMap((section) => Object.values(section));
  return Array.from(
    { length: result.map_grid.columns * result.map_grid.rows },
    (_, index) => index,
  ).filter((index) => arrays.some((values) => values[index] !== null));
}

export function fireGridFeatures(data: FireData): FeatureCollection<Polygon> {
  const { result, cells } = data;
  const grid = result.map_grid;
  return {
    type: 'FeatureCollection',
    features: suppliedCellIds(data).map((index) => {
      const column = index % grid.columns;
      const row = Math.floor(index / grid.columns);
      const ring = [
        gridPosition(grid, column, row),
        gridPosition(grid, column + 1, row),
        gridPosition(grid, column + 1, row + 1),
        gridPosition(grid, column, row + 1),
        gridPosition(grid, column, row),
      ];
      return {
        type: 'Feature',
        id: index,
        geometry: { type: 'Polygon', coordinates: [ring] },
        properties: {
          index,
          stage: cells.model.stage[index],
          recovery: cells.model.recovery[index],
          ndvi: cells.optics.ndvi[index] === null ? null : cells.optics.ndvi[index]! / 100,
          zone: cells.map.zone[index],
          confidence: cells.map.confidence[index],
        },
      };
    }),
  };
}

export const STAGE_NAMES = ['Below 5 m', '5–10 m', 'Above 10 m'] as const;
export const CONFIDENCE_NAMES = [
  'Outside model coverage',
  'Current state only',
  'Current state and forecast',
] as const;
export function percent(value: number | null | undefined, scale = 1): string {
  return value == null ? 'Not supplied' : `${Math.round(value * scale)}%`;
}
