/**
 * Data contracts shared by the conversion script (Node) and the app (browser).
 * Keep this file free of DOM and Node APIs.
 *
 * Two layers:
 *  - RawRowSchema: one row of a `nisar_<site>.csv` export, exactly as produced by the
 *    GEE + Colab pipeline in SPACEAPPS_CONTEXT.md. Validates values and ranges.
 *  - PointFeatureSchema / PointCollectionSchema: the normalized, map-ready GeoJSON the
 *    app consumes from `public/data/points.geojson`.
 */
import { z } from 'zod';

/** Radar acquisition year; used for `age_years = REFERENCE_YEAR - fire_year`. */
export const REFERENCE_YEAR = 2026;

/** Forest-height stage thresholds in metres (stage 0: <5, 1: 5–10, 2: >=10). */
export const STAGE_BREAKS_M = [5, 10] as const;

export const SCHEMA_VERSION = 1;

// ---------------------------------------------------------------------------
// Raw CSV row
// ---------------------------------------------------------------------------

/** CSV cell → finite number. Empty cells are rejected, never coerced to 0. */
const num = z
  .string()
  .trim()
  .min(1, 'empty value')
  .transform(Number)
  .pipe(z.number({ error: 'not a number' }));

const int = num.pipe(z.number().int('expected an integer'));
const text = z.string().trim().min(1, 'empty value');

/** Sanity ranges for radar backscatter in dB (pipeline already drops < -25 dB for NISAR). */
const dB = num.pipe(z.number().min(-40).max(10));

const RawRowObject = z.object({
  site: text,
  fire_id: text,
  latitude: num.pipe(z.number().min(-90).max(90)),
  longitude: num.pipe(z.number().min(-180).max(180)),
  cls: int.pipe(
    z.union([z.literal(1), z.literal(2)], { error: 'expected 1 (burned) or 2 (unburned)' }),
  ),
  fireYear: int.pipe(z.number().min(0).max(REFERENCE_YEAR)),
  gediYear: int.pipe(z.number().min(2019).max(2023)),
  rh98: num.pipe(z.number().min(0).max(35)),
  NDVI: num.pipe(z.number().min(-1).max(1)),
  nisar_HV: dB,
  nisar_HH: dB,
  nisar_HVmHH: num,
  s1_VH: dB,
  s1_VV: dB,
  s1_VHmVV: num,
  s1_angle: num.pipe(z.number().min(0).max(90)),
  lc2001: int.pipe(z.number().min(0).max(17)),
  treecover2000: num.pipe(z.number().min(0).max(100)),
  lossyear: int.pipe(z.number().min(0)),
  nBurns: int.pipe(z.number().min(0)),
  worldcover: int,
  elev: num,
  slope: num.pipe(z.number().min(0).max(90)),
  rain_window_m: num.pipe(z.number().min(0)),
  nisar_granule: text,
  // `hbin` and `stratum` are sampling helpers derived from the target (rh98).
  // They are intentionally not read: using them anywhere would leak the label.
});

/** Columns a source CSV must contain. Extra columns are ignored. */
export const REQUIRED_COLUMNS = Object.keys(RawRowObject.shape);

/** Zod may run object refinements even when a field failed; only cross-check real numbers. */
const isNum = (...vs: unknown[]) => vs.every((v) => typeof v === 'number' && Number.isFinite(v));

export const RawRowSchema = RawRowObject.superRefine((r, ctx) => {
  const issue = (path: string, message: string) =>
    ctx.addIssue({ code: 'custom', path: [path], message });

  if (r.cls === 1 && isNum(r.fireYear) && r.fireYear < 2000) {
    issue('fireYear', 'burned point (cls=1) needs a fire year');
  }
  if (r.cls === 2 && isNum(r.fireYear) && r.fireYear !== 0) {
    issue('fireYear', 'unburned point (cls=2) must have fireYear 0');
  }
  if (
    isNum(r.nisar_HV, r.nisar_HH, r.nisar_HVmHH) &&
    Math.abs(r.nisar_HV - r.nisar_HH - r.nisar_HVmHH) > 1e-6
  ) {
    issue('nisar_HVmHH', 'does not equal nisar_HV - nisar_HH');
  }
  if (isNum(r.s1_VH, r.s1_VV, r.s1_VHmVV) && Math.abs(r.s1_VH - r.s1_VV - r.s1_VHmVV) > 1e-6) {
    issue('s1_VHmVV', 'does not equal s1_VH - s1_VV');
  }
});

export type RawRow = z.infer<typeof RawRowSchema>;

// ---------------------------------------------------------------------------
// Normalized, map-ready point
// ---------------------------------------------------------------------------

export const StageSchema = z.union([z.literal(0), z.literal(1), z.literal(2)]);
export type Stage = z.infer<typeof StageSchema>;

export const PointPropertiesSchema = z.object({
  point_id: z.string().min(1),
  site: z.string().min(1),
  /** Cross-validation group from the CSV `fire_id` (fire year + 0.25° cell). NOT a perimeter ID. */
  group_id: z.string().min(1),
  status: z.enum(['burned', 'unburned']),
  fire_year: z.number().int().nullable(),
  /** REFERENCE_YEAR - fire_year. Null for unburned reference points. */
  age_years: z.number().int().nullable(),
  /** gedi_year - fire_year: burn age when the lidar height was measured. */
  age_at_gedi_years: z.number().int().nullable(),
  gedi_year: z.number().int(),

  /** Observation: GEDI L2A rh98 canopy height (m). Reference data, not a prediction. */
  rh98_m: z.number(),
  /** Observation-derived stage from rh98 using STAGE_BREAKS_M. */
  lidar_stage: StageSchema,

  nisar_hv_db: z.number(),
  nisar_hh_db: z.number(),
  nisar_hv_minus_hh_db: z.number(),
  nisar_granule: z.string(),
  /** Acquisition date parsed from the granule name (YYYY-MM-DD), null if unparseable. */
  nisar_date: z.string().nullable(),
  s1_vh_db: z.number(),
  s1_vv_db: z.number(),
  s1_vh_minus_vv_db: z.number(),
  s1_angle_deg: z.number(),
  ndvi: z.number(),

  lc2001: z.number().int(),
  treecover2000_pct: z.number(),
  worldcover: z.number().int(),
  elev_m: z.number(),
  slope_deg: z.number(),
  rain_window_m: z.number(),
});
export type PointProperties = z.infer<typeof PointPropertiesSchema>;

/** Point properties plus the feature's coordinates (degrees, EPSG:4326). */
export type LocatedPoint = PointProperties & { lon: number; lat: number };

export const PointFeatureSchema = z.object({
  type: z.literal('Feature'),
  id: z.string(),
  geometry: z.object({
    type: z.literal('Point'),
    /** [longitude, latitude], EPSG:4326 */
    coordinates: z.tuple([z.number(), z.number()]),
  }),
  properties: PointPropertiesSchema,
});
export type PointFeature = z.infer<typeof PointFeatureSchema>;

export const PointCollectionSchema = z.object({
  type: z.literal('FeatureCollection'),
  features: z.array(PointFeatureSchema),
});
export type PointCollection = z.infer<typeof PointCollectionSchema>;

export const ManifestSchema = z.object({
  schema_version: z.literal(SCHEMA_VERSION),
  reference_year: z.number().int(),
  stage_breaks_m: z.tuple([z.number(), z.number()]),
  sources: z.array(z.object({ file: z.string(), sha256: z.string(), rows: z.number().int() })),
  counts: z.object({
    points: z.number().int(),
    burned: z.number().int(),
    unburned: z.number().int(),
    burned_groups: z.number().int(),
    by_lidar_stage: z.tuple([z.number().int(), z.number().int(), z.number().int()]),
  }),
  sites: z.array(z.string()),
  fire_years: z.array(z.number().int()),
  nisar_dates: z.array(z.string()),
  /** [west, south, east, north] */
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
});
export type Manifest = z.infer<typeof ManifestSchema>;
