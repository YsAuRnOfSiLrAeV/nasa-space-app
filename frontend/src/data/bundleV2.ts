/**
 * Bundle format 2 (forestrecovery export): schemas and the one reader every supplied
 * fire goes through. The reader follows the fire's manifest, so a fire with only a
 * perimeter and a fire with cells, picture, GEDI points and a timeline use the same
 * code. Nothing here depends on a fire's id or region.
 *
 * `readFireBundle` returns the normalized `FireBundle` (fireTypes.ts);
 * `loadBundleV2` wraps it in the `FireData` the investigation components already read.
 */
import { z } from 'zod';
import { ForecastSeriesSchema } from './forecastSchema';
import {
  FireAssetPath,
  FirePerimeterSchema,
  FireResultSchema,
  parseFireCells,
  type DemoFire,
  type FireData,
} from './fireSchema';
import { BUNDLE_FILES, bundleCapabilities } from './fireCapabilities';
import type {
  FireBundle,
  FireCellGeometry,
  FireForecast,
  FireImage,
  FireObservation,
  ImageCorners,
} from './fireTypes';

/** A supplied file is missing, unreadable or does not follow bundle format 2. */
export class BundleFormatError extends Error {
  constructor(
    /** The file at fault, relative to the fire's folder (or `index.json`). */
    readonly resource: string,
    detail: string,
  ) {
    super(`${resource}: ${detail}`);
    this.name = 'BundleFormatError';
  }
}

const Share = z.number().min(0).max(1);
/** Recovery relative to the reference forest: usually 0..1, slightly above 1 is valid. */
const Recovery = z.number().min(0).max(2);
const Year = z.number().int().min(1900).max(2200);
const Position = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);
const Files = z
  .array(FireAssetPath)
  .refine((files) => new Set(files).size === files.length, 'Duplicate resource names');

export const BundleIndexSchema = z
  .object({
    bundle_format: z.literal(2),
    library_version: z.string(),
    summer: Year,
    fires: z.array(
      z
        .object({
          id: z.string().min(1),
          year: Year,
          area_ha: z.number().nonnegative().nullable(),
          region: z.string(),
          lon: z.number().min(-180).max(180),
          lat: z.number().min(-90).max(90),
          dir: FireAssetPath,
          files: Files,
          /** The index's own summary of model 2: `growth`, `state_only` or `none`. */
          forecast: z.string().optional(),
          has_grid: z.boolean().optional(),
          has_points: z.boolean().optional(),
          model1_mean: Share.nullable().optional(),
          excluded_share: Share.nullable().optional(),
          recovery_now: Recovery.nullable().optional(),
          year_80pct: Year.nullable().optional(),
        })
        .passthrough(),
    ),
  })
  .superRefine((index, context) => {
    for (const key of ['id', 'dir'] as const)
      if (new Set(index.fires.map((fire) => fire[key])).size !== index.fires.length)
        context.addIssue({ code: 'custom', message: `Every fire needs its own ${key}.` });
  });
export type BundleEntry = z.infer<typeof BundleIndexSchema>['fires'][number];

const ManifestSchema = z.object({
  bundle_format: z.literal(2),
  library_version: z.string(),
  fire_id: z.string(),
  summer: Year,
  files: Files,
  roles: z.record(z.string(), z.string()).optional(),
});

export const SeriesSchema = ForecastSeriesSchema;
export type SuppliedSeries = z.infer<typeof SeriesSchema>;

// Objects are open (`passthrough`): fields the app does not read yet stay in `source`,
// so the exporter's provenance and notes are never dropped.
const ResultSchema = z
  .object({
    fire: z
      .object({
        id: z.string().min(1),
        year: Year,
        area_ha: z.number().nonnegative().nullable(),
        region: z.string(),
        centroid: Position,
        model_region: z.string().optional(),
        reliability_of_region: z.string().optional(),
      })
      .passthrough(),
    period: z
      .object({ summer: Year, months: z.array(z.number().int().min(1).max(12)).optional() })
      .passthrough(),
    grid: z.object({ cell_m: z.number().positive() }).passthrough(),
    model1: z
      .object({
        mean: Share.nullable().optional(),
        share_gt_0_5: Share.nullable().optional(),
        excluded_share: Share.nullable().optional(),
        n: z.number().int().nonnegative().optional(),
        unit: z.string().optional(),
        meaning: z.string().optional(),
        grid_shape: z.tuple([z.number().int().positive(), z.number().int().positive()]).optional(),
      })
      .passthrough()
      .nullable(),
    model2: z
      .object({
        forecast: z.enum(['growth', 'none']),
        reason: z.string().optional(),
        valid_region: z.string().optional(),
        now_recovery: Recovery.nullable().optional(),
        interval_80: z.tuple([Recovery, Recovery]).nullable().optional(),
        year_80pct: Year.nullable().optional(),
        years_to_80pct: z.number().positive().nullable().optional(),
        series: SeriesSchema.optional(),
        warnings: z.array(z.string()).optional(),
      })
      .passthrough()
      .superRefine((model, context) => {
        if ((model.forecast === 'growth') !== (model.series !== undefined))
          context.addIssue({
            code: 'custom',
            message: 'A growth forecast needs its series; no forecast must not carry one.',
          });
        if (model.interval_80 && model.interval_80[0] > model.interval_80[1])
          context.addIssue({ code: 'custom', message: 'The 80% interval is reversed.' });
      }),
    reference: z
      .object({ height_m: z.number().positive().nullable(), source: z.string() })
      .passthrough()
      .nullable(),
    image: z
      .object({
        file: FireAssetPath,
        corners_lonlat: z.tuple([Position, Position, Position, Position]),
        width: z.number().int().positive(),
        height: z.number().int().positive(),
        pixel_m: z.number().positive().optional(),
        note: z.string().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
    reliability: z.record(z.string(), z.string()),
  })
  .passthrough();
export type BundleResult = z.infer<typeof ResultSchema>;

const CellRecord = z
  .object({
    row: z.number().int().nonnegative(),
    col: z.number().int().nonnegative(),
    lon: z.number().min(-180).max(180),
    lat: z.number().min(-90).max(90),
    p_forest_gt5: Share.nullable(),
    recovery: Recovery.nullable(),
    height_m: z.number().nonnegative().nullable(),
    ndvi: z.number().min(-1).max(1).nullable(),
  })
  .passthrough();
const CellsSchema = z
  .object({
    cell_m: z.number().positive(),
    shape: z.tuple([z.number().int().positive(), z.number().int().positive()]),
    cells: z.array(CellRecord),
    crs_source: z.string().optional(),
    rot_deg: z.number().optional(),
  })
  .passthrough();
const CellGeoSchema = z.object({
  type: z.literal('FeatureCollection'),
  features: z.array(
    z.object({
      type: z.literal('Feature'),
      id: z.union([z.string(), z.number()]).optional(),
      geometry: FirePerimeterSchema.refine((geometry) => geometry.type === 'Polygon'),
      properties: z
        .object({
          i: z.number().int().nonnegative(),
          row: z.number().int().nonnegative(),
          col: z.number().int().nonnegative(),
        })
        .passthrough(),
    }),
  ),
});
const GediSchema = z.object({
  type: z.literal('FeatureCollection'),
  features: z.array(
    z.object({
      type: z.literal('Feature'),
      geometry: z.object({ type: z.literal('Point'), coordinates: Position }),
      properties: z.object({ rh98_m: z.number().nonnegative() }).passthrough(),
    }),
  ),
});
const PerimeterSchema = z.object({
  type: z.literal('Feature'),
  geometry: FirePerimeterSchema,
  properties: z.object({ fire_id: z.string().optional() }).passthrough().nullable().optional(),
});
export const TimelineSchema = z
  .object({
    years: z.array(Year),
    cells: z.literal('same order as cells.json'),
    ref_height_m: z.number().positive(),
    recovery_pct: z.array(z.array(z.number().int().min(0).max(130).nullable())),
    note: z.string().optional(),
  })
  .superRefine((timeline, context) => {
    if (
      !timeline.years.length ||
      // Any increasing list of years is a valid timeline: the controls step through the
      // years that are there and do not assume one per calendar year.
      timeline.years.some((year, index) => index > 0 && year <= timeline.years[index - 1]!) ||
      timeline.recovery_pct.length !== timeline.years.length ||
      timeline.recovery_pct.some((values) => values.length !== timeline.recovery_pct[0]?.length)
    )
      context.addIssue({ code: 'custom', message: 'Invalid timeline dimensions or years.' });
  });

/** One loaded fire: the normalized bundle, with the complete validated `result.json`. */
export type BundleV2Data = FireBundle<BundleResult>;

/** Validate one supplied file, naming it and the first field at fault. */
function check<T>(schema: z.ZodType<T>, value: unknown, resource: string): T {
  const parsed = schema.safeParse(value);
  if (parsed.success) return parsed.data;
  const issue = parsed.error.issues[0];
  throw new BundleFormatError(
    resource,
    `does not follow bundle format 2 (${issue?.path.join('.') || 'root'}: ${issue?.message}).`,
  );
}

/** The root `index.json` of an export. */
export function parseBundleIndex(value: unknown): z.infer<typeof BundleIndexSchema> {
  return check(BundleIndexSchema, value, 'index.json');
}

export function bundleCellIndex(
  bundle: Pick<BundleV2Data, 'geometry'>,
  point: [number, number],
  columns: number,
): number | null {
  const inside = (ring: number[][]) => {
    let hit = false;
    for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
      const start = ring[index]!;
      const end = ring[previous]!;
      if (
        start[1]! > point[1] !== end[1]! > point[1] &&
        point[0] <
          ((end[0]! - start[0]!) * (point[1] - start[1]!)) / (end[1]! - start[1]!) + start[0]!
      )
        hit = !hit;
    }
    return hit;
  };
  const feature = bundle.geometry.features.find(
    (feature) =>
      inside(feature.geometry.coordinates[0]!) &&
      !feature.geometry.coordinates.slice(1).some(inside),
  );
  return feature
    ? Number(feature.properties!.row) * columns + Number(feature.properties!.col)
    : null;
}

/** A catalog entry for a supplied fire, with what its declared files allow. */
export function bundleIndexEntry(entry: BundleEntry, summer: number): DemoFire {
  return {
    id: entry.id,
    name: { en: entry.id, uk: '' },
    year: entry.year,
    area_ha: entry.area_ha,
    summer,
    center_lonlat: [entry.lon, entry.lat],
    recovery_today_avg: null,
    area_recovered_80pct: null,
    year_80pct: entry.year_80pct ?? null,
    result: `${entry.dir}/result.json`,
    region: entry.region,
    capabilities: {
      spatial: entry.files.includes('cells.json') && entry.files.includes('cells.geojson'),
      perimeter: entry.files.includes('polygon.geojson'),
      imagery: entry.files.includes('rgb.png'),
      gedi: entry.files.includes('gedi.geojson'),
      timeline: entry.files.includes('timeline.json'),
      forecast: entry.forecast === 'growth',
    },
  };
}

function forecastOf(model: BundleResult['model2']): FireForecast {
  if (model.forecast !== 'growth' || !model.series)
    return { kind: 'none', reason: model.reason ?? null };
  return {
    kind: 'growth',
    now_recovery: model.now_recovery ?? null,
    interval_80: model.interval_80 ?? null,
    year_80pct: model.year_80pct ?? null,
    years_to_80pct: model.years_to_80pct ?? null,
    valid_region: model.valid_region ?? null,
    series: model.series,
  };
}

/**
 * Read one fire. The index entry says where it is; its manifest says which files
 * exist. A file the manifest lists must load and be valid; a file it does not list
 * is simply absent. `read` fetches and parses one JSON file; `signal` stops the work
 * between files when the reader's selection has moved on.
 */
export async function readFireBundle(
  base: string,
  entry: BundleEntry,
  summer: number,
  read: (url: string) => Promise<unknown>,
  signal?: AbortSignal,
): Promise<BundleV2Data> {
  const url = (file: string) => `${base}/${entry.dir}/${file}`;
  if (!entry.files.includes(BUNDLE_FILES.manifest) || !entry.files.includes(BUNDLE_FILES.result))
    throw new BundleFormatError('index.json', 'Bundle manifest and result are required.');
  signal?.throwIfAborted();
  const manifest = check(
    ManifestSchema,
    await read(url(BUNDLE_FILES.manifest)),
    BUNDLE_FILES.manifest,
  );
  if (
    manifest.fire_id !== entry.id ||
    manifest.summer !== summer ||
    manifest.files.length !== entry.files.length ||
    manifest.files.some((file) => !entry.files.includes(file))
  )
    throw new BundleFormatError(BUNDLE_FILES.manifest, 'Manifest does not match bundle index.');
  signal?.throwIfAborted();

  const listed = (name: string) => manifest.files.includes(name);
  const optional = (name: string) => (listed(name) ? read(url(name)) : null);
  const [resultRaw, perimeterRaw, cellsRaw, geometryRaw, gediRaw, timelineRaw] = await Promise.all([
    read(url(BUNDLE_FILES.result)),
    optional(BUNDLE_FILES.perimeter),
    optional(BUNDLE_FILES.cells),
    optional(BUNDLE_FILES.cellGeometry),
    optional(BUNDLE_FILES.observations),
    optional(BUNDLE_FILES.timeline),
  ]);
  signal?.throwIfAborted();

  const source = check(ResultSchema, resultRaw, BUNDLE_FILES.result);
  if (
    source.fire.id !== entry.id ||
    source.fire.year !== entry.year ||
    source.period.summer !== summer
  )
    throw new BundleFormatError(
      BUNDLE_FILES.result,
      'Result identity does not match bundle index.',
    );
  if (source.model2.series && !source.model2.series.years.includes(summer))
    throw new BundleFormatError(
      BUNDLE_FILES.result,
      'The forecast series does not include the observation summer.',
    );

  const perimeterFeature =
    perimeterRaw === null ? null : check(PerimeterSchema, perimeterRaw, BUNDLE_FILES.perimeter);
  if (perimeterFeature?.properties?.fire_id && perimeterFeature.properties.fire_id !== entry.id)
    throw new BundleFormatError(BUNDLE_FILES.perimeter, 'The perimeter belongs to another fire.');
  const perimeter = perimeterFeature?.geometry ?? null;

  if ((cellsRaw === null) !== (geometryRaw === null))
    throw new BundleFormatError(
      cellsRaw === null ? BUNDLE_FILES.cells : BUNDLE_FILES.cellGeometry,
      'Cell records and polygons must be supplied together.',
    );
  const records = cellsRaw === null ? null : check(CellsSchema, cellsRaw, BUNDLE_FILES.cells);
  const geometry =
    geometryRaw === null
      ? { type: 'FeatureCollection' as const, features: [] }
      : check(CellGeoSchema, geometryRaw, BUNDLE_FILES.cellGeometry);
  if (geometry.features.length !== (records?.cells.length ?? 0))
    throw new BundleFormatError(BUNDLE_FILES.cellGeometry, 'Cell geometry count mismatch.');
  if (records) {
    const shape = source.model1?.grid_shape;
    if (shape && (shape[0] !== records.shape[0] || shape[1] !== records.shape[1]))
      throw new BundleFormatError(BUNDLE_FILES.cells, 'Grid shape differs from the result.');
    if (records.cell_m !== source.grid.cell_m)
      throw new BundleFormatError(BUNDLE_FILES.cells, 'Cell size differs from the result.');
  }
  const identities = new Set<number>();
  geometry.features.forEach((feature) => {
    const index = feature.properties.i;
    const cell = records?.cells[index];
    if (
      !cell ||
      identities.has(index) ||
      feature.properties.row !== cell.row ||
      feature.properties.col !== cell.col ||
      cell.row >= records!.shape[0] ||
      cell.col >= records!.shape[1]
    )
      throw new BundleFormatError(BUNDLE_FILES.cellGeometry, 'Invalid cell identity or position.');
    identities.add(index);
  });

  const timeline =
    timelineRaw === null ? null : check(TimelineSchema, timelineRaw, BUNDLE_FILES.timeline);
  if (
    timeline &&
    timeline.recovery_pct.some((values) => values.length !== (records?.cells.length ?? 0))
  )
    throw new BundleFormatError(BUNDLE_FILES.timeline, 'Timeline cell count mismatch.');

  const gedi =
    gediRaw === null ? { features: [] } : check(GediSchema, gediRaw, BUNDLE_FILES.observations);
  const observations: FireObservation[] = gedi.features.map((point) => ({
    lon: point.geometry.coordinates[0],
    lat: point.geometry.coordinates[1],
    rh98_m: point.properties.rh98_m,
  }));

  // The picture exists only when the result describes it and the manifest lists its file.
  const image: FireImage | null =
    source.image && listed(source.image.file)
      ? {
          url: url(source.image.file),
          corners_lonlat: source.image.corners_lonlat as ImageCorners,
          width: source.image.width,
          height: source.image.height,
          pixel_m: source.image.pixel_m ?? null,
          note: source.image.note ?? null,
        }
      : null;

  const parts = {
    perimeter,
    cells: records?.cells ?? [],
    observations,
    image,
    timeline,
    forecast: forecastOf(source.model2),
  };
  return {
    metadata: {
      id: source.fire.id,
      year: source.fire.year,
      area_ha: source.fire.area_ha,
      region: source.fire.region,
      centroid: source.fire.centroid,
      summer,
      months: source.period.months ?? null,
      model_region: source.fire.model_region ?? null,
      reliability_of_region: source.fire.reliability_of_region ?? null,
      library_version: manifest.library_version,
    },
    capabilities: bundleCapabilities(parts),
    ...parts,
    grid: records
      ? {
          cell_m: records.cell_m,
          rows: records.shape[0],
          columns: records.shape[1],
          crs_source: records.crs_source ?? null,
          rot_deg: records.rot_deg ?? null,
        }
      : null,
    geometry: geometry as FireCellGeometry,
    imageCorners: (source.image?.corners_lonlat as ImageCorners | undefined) ?? null,
    score: source.model1
      ? {
          mean: source.model1.mean ?? null,
          share_gt_0_5: source.model1.share_gt_0_5 ?? null,
          excluded_share: source.model1.excluded_share ?? null,
          n: source.model1.n ?? null,
          unit: source.model1.unit ?? null,
          meaning: source.model1.meaning ?? null,
        }
      : null,
    reference: source.reference
      ? { height_m: source.reference.height_m, source: source.reference.source }
      : null,
    warnings: source.model2.warnings ?? [],
    reliability: source.reliability,
    roles: manifest.roles ?? {},
    source,
  };
}

/** The four corners the existing map components frame a fire by: the picture's, else the perimeter's box. */
function frameCorners(bundle: BundleV2Data): ImageCorners {
  if (bundle.source.image) return bundle.source.image.corners_lonlat as ImageCorners;
  if (!bundle.perimeter)
    throw new BundleFormatError(BUNDLE_FILES.result, 'Bundle has no image or perimeter bounds.');
  const positions =
    bundle.perimeter.type === 'Polygon'
      ? bundle.perimeter.coordinates.flat()
      : bundle.perimeter.coordinates.flat(2);
  const xs = positions.map((point) => point[0]!);
  const ys = positions.map((point) => point[1]!);
  return [
    [Math.min(...xs), Math.max(...ys)],
    [Math.max(...xs), Math.max(...ys)],
    [Math.max(...xs), Math.min(...ys)],
    [Math.min(...xs), Math.min(...ys)],
  ];
}

/**
 * A supplied fire as the `FireData` the investigation components read: the bundle
 * itself, plus the legacy-shaped result and dense cell arrays those components share
 * with v1 exports. Values the bundle does not supply stay null there too.
 */
export async function loadBundleV2(
  base: string,
  entry: BundleEntry,
  summer: number,
  read: (url: string) => Promise<unknown>,
  signal?: AbortSignal,
): Promise<FireData> {
  const bundle = await readFireBundle(base, entry, summer, read, signal);
  const { source } = bundle;
  const framed = FireResultSchema.safeParse({
    schema_version: 1,
    fire: { ...source.fire, name: { en: entry.id, uk: '' }, perimeter: bundle.perimeter },
    satellite_images: { summer },
    map_grid: {
      rows: bundle.grid?.rows ?? 1,
      columns: bundle.grid?.columns ?? 1,
      cell_size_m: bundle.grid?.cell_m ?? source.grid.cell_m,
      corners_lonlat: frameCorners(bundle),
    },
    neighbour_forest: source.reference,
    model_result: {
      model_version: `forestrecovery ${bundle.metadata.library_version}`,
      region: source.fire.region,
    },
    growth_forecast: null,
    comparison: null,
    lidar_points: bundle.observations.map((point) => ({
      lon: point.lon,
      lat: point.lat,
      height_m: point.rh98_m,
    })),
    files: { cells: BUNDLE_FILES.cells, optical_image: null },
    warnings: bundle.warnings,
  });
  if (!framed.success) {
    const issue = framed.error.issues[0];
    throw new BundleFormatError(
      BUNDLE_FILES.result,
      `cannot be shown (${issue?.path.join('.') || 'root'}: ${issue?.message}).`,
    );
  }
  const result = framed.data;
  const cells = parseFireCells({}, result.map_grid);
  for (const cell of bundle.cells) {
    const index = cell.row * result.map_grid.columns + cell.col;
    cells.model.p_forest_gt5[index] = cell.p_forest_gt5 === null ? null : cell.p_forest_gt5 * 100;
    cells.model.recovery[index] = cell.recovery === null ? null : cell.recovery * 100;
    cells.optics.ndvi[index] = cell.ndvi === null ? null : cell.ndvi * 100;
  }
  return { result, cells, opticalImageUrl: bundle.image?.url ?? null, bundle };
}
