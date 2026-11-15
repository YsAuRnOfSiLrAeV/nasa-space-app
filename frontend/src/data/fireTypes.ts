/**
 * The normalized shape of one supplied fire (bundle format 2), whatever resources it has.
 *
 * Field names and units are the source's own, so a value can always be traced back to
 * its file. A value the export does not supply is `null`, never zero and never
 * estimated; a resource the manifest does not list is `null` or an empty list.
 * `fireCapabilities.ts` says which parts a fire has.
 */
import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson';

export type LonLat = [number, number];
/** Top-left, top-right, bottom-right, bottom-left: the order MapLibre image sources use. */
export type ImageCorners = [LonLat, LonLat, LonLat, LonLat];

/** Identity and context of the fire (`result.fire`, `result.period`, the manifest). */
export interface FireMetadata {
  id: string;
  year: number;
  area_ha: number | null;
  region: string;
  centroid: LonLat;
  /** The observation summer every "now" value refers to. */
  summer: number;
  months: number[] | null;
  /** Which model-1 region the fire falls in, and how reliable that region is. */
  model_region: string | null;
  reliability_of_region: string | null;
  library_version: string;
}

export type FirePerimeter = Polygon | MultiPolygon;

/** One 360 m cell (`cells.json`). Its position in the list is its `i` everywhere else. */
export interface FireCell {
  row: number;
  col: number;
  lon: number;
  lat: number;
  /** Model 1: a ranking score in 0..1, not a calibrated probability. */
  p_forest_gt5: number | null;
  /** Share of the reference forest height now; may slightly exceed 1. */
  recovery: number | null;
  /** Modeled canopy height (recovery × reference height), not a measurement. */
  height_m: number | null;
  ndvi: number | null;
}

/** The raster the cells come from. */
export interface FireCellGrid {
  cell_m: number;
  rows: number;
  columns: number;
  crs_source: string | null;
  rot_deg: number | null;
}

/** A measured GEDI canopy height (`gedi.geojson`): the only measured heights in a bundle. */
export interface FireObservation {
  lon: number;
  lat: number;
  rh98_m: number;
}

/** The Sentinel-2 picture and where it sits. The raster is rotated: place it by its corners. */
export interface FireImage {
  url: string;
  corners_lonlat: ImageCorners;
  width: number;
  height: number;
  pixel_m: number | null;
  note: string | null;
}

/** Modeled recovery of every cell by year (`timeline.json`): `recovery_pct[year][cell]`. */
export interface FireTimeline {
  years: number[];
  cells: string;
  ref_height_m: number;
  recovery_pct: (number | null)[][];
  note?: string;
}

export interface ForecastSeries {
  years: number[];
  recovery: (number | null)[];
  low: (number | null)[];
  high: (number | null)[];
}

/** Model 2: the fire-level growth forecast, or the supplied reason there is none. */
export type FireForecast =
  | {
      kind: 'growth';
      now_recovery: number | null;
      interval_80: [number, number] | null;
      year_80pct: number | null;
      years_to_80pct: number | null;
      valid_region: string | null;
      series: ForecastSeries;
    }
  | { kind: 'none'; reason: string | null };

/** Model 1 summarised over the fire (from cells, or from GEDI points where there is no raster). */
export interface FireScore {
  mean: number | null;
  share_gt_0_5: number | null;
  excluded_share: number | null;
  n: number | null;
  unit: string | null;
  /** The source's own statement of what the number is (a ranking score). */
  meaning: string | null;
}

/** The forest height that counts as 100% recovery, and where it comes from. */
export interface FireReference {
  height_m: number | null;
  source: string;
}

/**
 * Which parts of a fire exist. Decided by its manifest and result, never by region or
 * id. Same keys as the catalog entry's `capabilities` (fireSchema.ts): `spatial` is the
 * cell grid, `imagery` the picture, `gedi` the measured points.
 */
export interface FireCapabilities {
  spatial: boolean;
  perimeter: boolean;
  imagery: boolean;
  gedi: boolean;
  timeline: boolean;
  forecast: boolean;
}

export type FireCellGeometry = FeatureCollection<Polygon>;

/** Everything one fire supplies, in one object. */
export interface FireBundle<Source = unknown> {
  metadata: FireMetadata;
  capabilities: FireCapabilities;
  perimeter: FirePerimeter | null;
  grid: FireCellGrid | null;
  cells: FireCell[];
  /** The cells as the supplied polygons, in the same order, with their supplied properties. */
  geometry: FireCellGeometry;
  observations: FireObservation[];
  image: FireImage | null;
  /** `image.corners_lonlat`, or null without a picture. */
  imageCorners: ImageCorners | null;
  timeline: FireTimeline | null;
  forecast: FireForecast;
  score: FireScore | null;
  reference: FireReference | null;
  /** Model warning codes, exactly as supplied. */
  warnings: string[];
  /** The source's reliability statements, keyed as supplied; show them beside the numbers. */
  reliability: Record<string, string>;
  /** What each file is, in the exporter's words (`manifest.roles`). */
  roles: Record<string, string>;
  /** The validated `result.json`, complete: nothing the exporter wrote is dropped. */
  source: Source;
}
