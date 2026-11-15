import { useEffect, useMemo } from 'react';
import type { FireGridController } from '@/components/fire/fireGridController';
import { rasterImageUrl } from '@/components/fire/gridRasterImage';
import type { Corners } from '@/components/map/fireLayers';
import type { FireData } from '@/data/fireSchema';
import type { FireOverlayVisibility } from '@/domain/fire/overlays';
import { spatialValues, SPATIAL_RAMP, type SpatialLayerId } from '@/domain/fire/spatialLayers';
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
  timelineYear,
  spatialLayer = 'score',
}: {
  mapView: FireGridController | null;
  data: FireData;
  layer: GridLayerId;
  overlays: FireOverlayVisibility;
  opticalReady: boolean;
  inspected: number | null;
  timelineYear?: number | null;
  spatialLayer?: SpatialLayerId;
}) {
  const { result, cells } = data;
  const grid = result.map_grid;
  const geometry = useMemo(() => {
    if (!data.bundle) return undefined;
    const bundle = data.bundle;
    return {
      ...bundle.geometry,
      features: bundle.geometry.features.map((feature) => {
        return { ...feature, properties: { ...feature.properties, _displayColor: 'transparent' } };
      }),
    };
  }, [data.bundle]);
  // The timeline's values for the chosen year, in the cells' own order (null: timeline off).
  const timelineValues = useMemo(
    () => (data.bundle ? spatialValues(data, spatialLayer, timelineYear).normalized : null),
    [data, spatialLayer, timelineYear],
  );
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
        cellGeometry: geometry,
        opticalCorners: data.bundle?.imageCorners ?? undefined,
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
  }, [
    mapView,
    gridImage,
    zoneImage,
    outline,
    grid,
    result,
    opticalReady,
    data.opticalImageUrl,
    geometry,
    data.bundle?.imageCorners,
  ]);

  // A year change only updates each cell's state on the layer drawn above: the
  // polygons are not rebuilt or sent to the map again.
  useEffect(() => {
    if (!mapView || !geometry) return;
    mapView.setFireCellValues(timelineValues, SPATIAL_RAMP);
  }, [mapView, geometry, timelineValues]);

  useEffect(() => {
    mapView?.setFireOverlays({
      ...overlays,
      cells: overlays.cells !== false && (data.bundle ? data.bundle.cells.length > 0 : true),
    });
  }, [mapView, overlays, gridImage, zoneImage, opticalReady, data.bundle]);

  useEffect(() => {
    if (!mapView) return;
    return () => mapView.clearFireGrid();
  }, [mapView]);

  useEffect(() => {
    if (!mapView || !gridImage) return;
    const supplied = data.bundle?.geometry.features.find(
      (feature) =>
        Number(feature.properties!.row) * grid.columns + Number(feature.properties!.col) ===
        inspected,
    );
    mapView.setFireHighlight(
      inspected === null || overlays.cells === false
        ? null
        : data.bundle
          ? ((supplied?.geometry.coordinates[0] as [number, number][]) ?? null)
          : cellRing(grid, inspected),
      css('--ring'),
    );
  }, [mapView, gridImage, grid, inspected, data.bundle, overlays.cells]);
}
