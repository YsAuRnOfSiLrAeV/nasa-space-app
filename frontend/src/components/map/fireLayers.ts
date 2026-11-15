/**
 * Fire overlays on the shared map: ids and the data the controller draws.
 * DOM-free. Layer ids use the reserved `fires-` prefix (checked by map:validate).
 */
import type { Geometry } from 'geojson';

export const SOURCE_FIRE_MARKERS = 'fires-markers';
export const LAYER_FIRE_MARKERS = 'fires-markers-circle';
export const LAYER_FIRE_MARKER_LABELS = 'fires-markers-label';

export const SOURCE_FIRE_GRID = 'fires-grid';
export const LAYER_FIRE_GRID = 'fires-grid-raster';
export const SOURCE_FIRE_OPTICAL = 'fires-optical';
export const LAYER_FIRE_OPTICAL = 'fires-optical-raster';
export const SOURCE_FIRE_ZONE = 'fires-zone';
export const LAYER_FIRE_ZONE = 'fires-zone-raster';
export const SOURCE_FIRE_ZONE_LINE = 'fires-zone-line';
export const LAYER_FIRE_ZONE_LINE = 'fires-zone-outline';
export const SOURCE_FIRE_EXTENT = 'fires-extent';
export const LAYER_FIRE_EXTENT = 'fires-extent-line';
export const SOURCE_FIRE_PERIMETER = 'fires-perimeter';
export const LAYER_FIRE_PERIMETER = 'fires-perimeter-line';
export const SOURCE_FIRE_HIGHLIGHT = 'fires-highlight';
export const LAYER_FIRE_HIGHLIGHT = 'fires-highlight-line';
export const SOURCE_FIRE_GEDI = 'fires-gedi';
export const LAYER_FIRE_GEDI = 'fires-gedi-circle';

/** Bottom to top. Markers are separate so they survive a cleared grid. */
export const FIRE_GRID_LAYERS = [
  LAYER_FIRE_OPTICAL,
  LAYER_FIRE_GRID,
  LAYER_FIRE_ZONE,
  LAYER_FIRE_ZONE_LINE,
  LAYER_FIRE_EXTENT,
  LAYER_FIRE_PERIMETER,
  LAYER_FIRE_HIGHLIGHT,
  LAYER_FIRE_GEDI,
] as const;
export const FIRE_GRID_SOURCES = [
  SOURCE_FIRE_OPTICAL,
  SOURCE_FIRE_GRID,
  SOURCE_FIRE_ZONE,
  SOURCE_FIRE_ZONE_LINE,
  SOURCE_FIRE_EXTENT,
  SOURCE_FIRE_PERIMETER,
  SOURCE_FIRE_HIGHLIGHT,
  SOURCE_FIRE_GEDI,
] as const;

export type LngLat = [number, number];
/** TL, TR, BR, BL, the order of `map_grid.corners_lonlat` and of MapLibre image sources. */
export type Corners = [LngLat, LngLat, LngLat, LngLat];

export interface FireMarker {
  id: string;
  label: string;
  lonlat: LngLat;
}

export interface FireGridScene {
  corners: Corners;
  /** Categorical cell image (one pixel per cell), as a URL. */
  gridImage: string;
  /** Neighbouring-forest wash and outline; null when the export has no reference cells. */
  zoneImage: string | null;
  zoneOutline: LngLat[][];
  perimeter: Geometry | null;
  gedi: LngLat[];
  /** The export's own optical image, already confirmed to load; null otherwise. */
  opticalImage: string | null;
}

export type { FireOverlayVisibility } from '@/domain/fire/overlays';

export interface FireGridColors {
  zone: string;
  extent: string;
  perimeter: string;
  gediFill: string;
  gediStroke: string;
}

/** What is under the pointer on the fire layers. */
export interface FirePointer {
  /** `reset`: the camera started moving, so any pinned position is stale. */
  type: 'move' | 'click' | 'leave' | 'reset';
  lngLat: LngLat | null;
  point: { x: number; y: number } | null;
  /** Index into `lidar_points` when a GEDI footprint is hit. */
  gediIndex: number | null;
}
