import { useEffect, useMemo } from 'react';
import type { FireGridController } from '@/components/fire/fireGridController';
import { rasterImageUrl } from '@/components/fire/gridRasterImage';
import type { Corners } from '@/components/map/fireLayers';
import type { FireData } from '@/data/fireSchema';
import type { FireOverlayVisibility } from '@/domain/fire/overlays';
import {
  cellRing,
  GRID_FALLBACK_COLORS,
  GRID_LAYERS,
  layerPixels,
  parseHex,
  zoneOutline,
  zonePixels,
  type GridLayerId,
  type RGB,
} from '@/domain/fire/fireGrid';

const css = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim() ||
  GRID_FALLBACK_COLORS[name] ||
  '#808080';

/** Browser raster encoding and lifecycle of overlays on the existing map controller. */
export function useFireGridLayers({
  mapView,
  data,
  layer,
  overlays,
  opticalReady,
  inspected,
}: {
  mapView: FireGridController | null;
  data: FireData;
  layer: GridLayerId;
  overlays: FireOverlayVisibility;
  opticalReady: boolean;
  inspected: number | null;
}) {
  const { result, cells } = data;
  const grid = result.map_grid;
  const outline = useMemo(() => zoneOutline(data), [data]);
  const gridImage = useMemo(() => {
    const palette = {
      categories: GRID_LAYERS[layer].tokens.map((token) => parseHex(css(token))) as [RGB, RGB, RGB],
      outside: parseHex(css('--grid-outside')),
    };
    return rasterImageUrl(layerPixels(cells, layer, palette), grid.columns, grid.rows);
  }, [cells, layer, grid.columns, grid.rows]);
  const zoneImage = useMemo(() => {
    if (!cells.map.zone.some((zone) => zone === 0)) return null;
    return rasterImageUrl(zonePixels(cells, parseHex(css('--grid-zone'))), grid.columns, grid.rows);
  }, [cells, grid.columns, grid.rows]);

  useEffect(() => {
    if (!mapView || !gridImage) return;
    mapView.showFireGrid(
      {
        corners: grid.corners_lonlat as Corners,
        gridImage,
        zoneImage,
        zoneOutline: outline,
        perimeter: result.fire.perimeter,
        gedi: result.lidar_points.map((point) => [point.lon, point.lat]),
        opticalImage: opticalReady ? data.opticalImageUrl : null,
      },
      {
        zone: css('--grid-zone'),
        extent: css('--map-label'),
        perimeter: css('--amber'),
        gediFill: css('--map-background'),
        gediStroke: css('--foreground'),
      },
    );
  }, [mapView, gridImage, zoneImage, outline, grid, result, opticalReady, data.opticalImageUrl]);

  useEffect(() => {
    mapView?.setFireOverlays(overlays);
  }, [mapView, overlays, gridImage, zoneImage, opticalReady]);

  useEffect(() => {
    if (!mapView) return;
    return () => mapView.clearFireGrid();
  }, [mapView]);

  useEffect(() => {
    if (!mapView || !gridImage) return;
    mapView.setFireHighlight(inspected === null ? null : cellRing(grid, inspected), css('--ring'));
  }, [mapView, gridImage, grid, inspected]);
}
