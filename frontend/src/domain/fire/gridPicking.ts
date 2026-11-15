import type { FireData } from '@/data/fireSchema';
import { bundleCellIndex } from '@/data/bundleV2';
import { cellAt, describeCell, gediBand, type CellDescription, type GridLayerId } from './fireGrid';

export type GridTarget =
  { kind: 'cell'; cell: CellDescription } | { kind: 'gedi'; band: string; heightM?: number };

/** Geographic picking and categorical descriptions, independent of the map engine and DOM. */
export function pickGridTarget(
  data: FireData,
  layer: GridLayerId,
  lngLat: [number, number] | null,
  gediIndex: number | null,
): GridTarget | null {
  if (gediIndex !== null) {
    const point = data.result.lidar_points[gediIndex];
    return point
      ? {
          kind: 'gedi',
          band: gediBand(point.height_m),
          ...(data.bundle ? { heightM: point.height_m } : {}),
        }
      : null;
  }
  if (!lngLat) return null;
  const index = data.bundle
    ? bundleCellIndex(data.bundle, lngLat, data.result.map_grid.columns)
    : cellAt(data.result.map_grid, lngLat);
  return index === null ? null : { kind: 'cell', cell: describeCell(data, layer, index) };
}
