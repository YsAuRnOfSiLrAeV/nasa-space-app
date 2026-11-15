import { z } from 'zod';
import { ForecastSeriesSchema, ForecastIntervalSchema } from './forecastSchema';

// Contract from DELIVERABLES, tab 1. Fractions in summaries and percentages in
// cells intentionally have different units. Missing observations remain null.
const Fraction = z.number().min(0).max(1);
const RecoveryFraction = z.number().nonnegative();
const Percentage = z.number().min(0).max(100);
const Position = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);
const Name = z.object({ en: z.string().min(1), uk: z.string().default('') });
const Year = z.number().int().positive();
export const FireGridSchema = z
  .object({
    columns: z.number().int().positive(),
    rows: z.number().int().positive(),
    cell_size_m: z.number().positive(),
    corners_lonlat: z.tuple([Position, Position, Position, Position]),
  })
  .superRefine((grid, context) => {
    const corners = grid.corners_lonlat;
    const turns = corners.map((point, index) => {
      const next = corners[(index + 1) % 4]!;
      const after = corners[(index + 2) % 4]!;
      return (
        (next[0] - point[0]) * (after[1] - next[1]) - (next[1] - point[1]) * (after[0] - next[0])
      );
    });
    if (!turns.every((turn) => turn < 0) || corners.some((point) => Math.abs(point[1]) >= 90))
      context.addIssue({
        code: 'custom',
        message:
          'Grid corners must form a non-degenerate clockwise quadrilateral (TL, TR, BR, BL).',
      });
    if (!Number.isSafeInteger(grid.columns * grid.rows) || grid.columns * grid.rows > 500_000)
      context.addIssue({ code: 'custom', message: 'Grid exceeds the backend display-cell limit.' });
  });

// All assets are local paths relative to the index or result that names them.
// Reject traversal and remote URLs before requesting an asset.
export const FireAssetPath = z
  .string()
  .min(1)
  .refine(
    (path) =>
      !/[\\:#?%]/.test(path) &&
      !path.startsWith('/') &&
      path.split('/').every((part) => part !== '' && part !== '.' && part !== '..'),
    'Expected a relative asset path without parent traversal',
  );

const Ring = z
  .array(Position)
  .min(4)
  .refine(
    (ring) => ring[0]![0] === ring.at(-1)![0] && ring[0]![1] === ring.at(-1)![1],
    'Polygon rings must be closed',
  );
export const FirePerimeterSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('Polygon'), coordinates: z.array(Ring).min(1) }),
  z.object({ type: z.literal('MultiPolygon'), coordinates: z.array(z.array(Ring).min(1)).min(1) }),
]);

export const FireIndexSchema = z
  .array(
    z.object({
      id: z.string().min(1),
      name: Name,
      year: Year,
      area_ha: z.number().positive().nullable(),
      summer: Year,
      center_lonlat: Position,
      recovery_today_avg: RecoveryFraction.nullable(),
      area_recovered_80pct: Fraction.nullable().default(null),
      year_80pct: Year.nullable(),
      result: FireAssetPath,
      region: z.string().optional(),
      capabilities: z
        .object({
          spatial: z.boolean(),
          perimeter: z.boolean(),
          imagery: z.boolean(),
          gedi: z.boolean(),
          timeline: z.boolean(),
          forecast: z.boolean(),
        })
        .optional(),
    }),
  )
  .superRefine((entries, ctx) => {
    if (new Set(entries.map((entry) => entry.id)).size !== entries.length) {
      ctx.addIssue({ code: 'custom', message: 'Fire ids must be unique' });
    }
  });

export const FireResultSchema = z.object({
  schema_version: z.literal(1),
  fire: z.object({
    id: z.string().min(1),
    name: Name,
    year: Year,
    area_ha: z.number().positive().nullable(),
    perimeter: FirePerimeterSchema.nullable(),
  }),
  satellite_images: z.object({
    summer: Year,
    nisar: z.object({ date: z.iso.date().nullable(), fire_covered: Fraction.nullable() }).nullish(),
    sentinel1: z
      .object({ from: z.iso.date(), to: z.iso.date(), scenes: z.number().int().nonnegative() })
      .nullish(),
    sentinel2: z
      .object({
        from: z.iso.date(),
        to: z.iso.date(),
        scenes: z.number().int().nonnegative().optional(),
      })
      .nullish(),
  }),
  map_grid: FireGridSchema,
  neighbour_forest: z
    .object({ height_m: z.number().positive().nullable(), source: z.string() })
    .nullable(),
  model_result: z
    .object({
      model_version: z.string().default('Not supplied'),
      region: z.string().default('Not supplied'),
      recovery_today_avg: RecoveryFraction.nullable().default(null),
      area_recovered_80pct: Fraction.nullable().default(null),
      stage_share: z.tuple([Fraction, Fraction, Fraction]).nullable().default(null),
      error_vs_lidar_pct: z.number().nonnegative().nullable().default(null),
      excluded_share: Fraction.nullable().default(null),
      accuracy: z
        .object({
          error_vs_lidar_pct: z.number().nonnegative(),
          mae_m: z.number().nonnegative(),
          null_model_mae_m: z.number().nonnegative(),
          n_fires: z.number().int().positive(),
          min_gedi_points: z.number().int().positive(),
        })
        .nullable()
        .default(null),
    })
    .nullable()
    .transform(
      (value) =>
        value ?? {
          model_version: 'Not supplied',
          region: 'Not supplied',
          recovery_today_avg: null,
          area_recovered_80pct: null,
          stage_share: null,
          error_vs_lidar_pct: null,
          excluded_share: null,
          accuracy: null,
        },
    ),
  growth_forecast: z
    .object({
      method: z.string(),
      tau: z.number().positive().nullable(),
      years_to_80pct: z.number().nonnegative().nullable(),
      year_80pct: Year.nullable(),
      series: ForecastSeriesSchema.optional(),
      interval_80_now: ForecastIntervalSchema.nullable().optional(),
      reliable_age: z
        .tuple([z.number().nonnegative(), z.number().nonnegative()])
        .refine(([from, to]) => from <= to, 'Reliable ages must be ordered'),
    })
    .nullish(),
  comparison: z
    .object({
      optics: RecoveryFraction.nullable(),
      model: RecoveryFraction.nullable(),
      lidar: RecoveryFraction.nullable(),
      lidar_points_in_fire: z.number().int().nonnegative(),
    })
    .nullish(),
  lidar_points: z.array(
    z.object({
      lon: z.number().min(-180).max(180),
      lat: z.number().min(-90).max(90),
      height_m: z.number().nonnegative(),
    }),
  ),
  files: z.object({ cells: FireAssetPath, optical_image: FireAssetPath.nullish() }),
  warnings: z.array(z.string()),
});

export const ExportCellsSchema = z.lazy(() =>
  z
    .object({
      model: FireCellsSchema.shape.model.partial().strict().optional(),
      map: FireCellsSchema.shape.map.partial().strict().optional(),
      optics: FireCellsSchema.shape.optics.partial().strict().optional(),
    })
    .strict(),
);

export function parseFireCells(input: unknown, grid: FireResult['map_grid']): FireCells {
  FireGridSchema.parse(grid);
  const raw = ExportCellsSchema.parse(input);
  const length = grid.columns * grid.rows;
  const empty = () => Array<null>(length).fill(null);
  const cells: FireCells = {
    model: {
      stage: raw.model?.stage ?? empty(),
      p_forest_gt5: raw.model?.p_forest_gt5 ?? empty(),
      recovery: raw.model?.recovery ?? empty(),
    },
    map: {
      zone: raw.map?.zone ?? empty(),
      confidence: raw.map?.confidence ?? empty(),
      reburn_year: raw.map?.reburn_year ?? empty(),
    },
    optics: { ndvi: raw.optics?.ndvi ?? empty() },
  };
  validateFireCells(cells, grid);
  return cells;
}

export const FireCellsSchema = z.object({
  model: z.object({
    stage: z.array(z.union([z.literal(0), z.literal(1), z.literal(2)]).nullable()),
    p_forest_gt5: z.array(Percentage.nullable()),
    recovery: z.array(z.number().nonnegative().nullable()),
  }),
  map: z.object({
    zone: z.array(z.union([z.literal(0), z.literal(1)]).nullable()),
    confidence: z.array(z.union([z.literal(0), z.literal(1), z.literal(2)]).nullable()),
    reburn_year: z.array(Year.nullable()),
  }),
  optics: z.object({ ndvi: z.array(z.number().min(-100).max(100).nullable()) }),
});

export type DemoFire = z.infer<typeof FireIndexSchema>[number];
export type FireResult = z.infer<typeof FireResultSchema>;
export type FireCells = z.infer<typeof FireCellsSchema>;
export interface FireData {
  bundle?: import('./bundleV2').BundleV2Data;
  result: FireResult;
  cells: FireCells;
  opticalImageUrl: string | null;
}

export function validateFireCells(cells: FireCells, grid: FireResult['map_grid']) {
  FireGridSchema.parse(grid);
  const length = grid.columns * grid.rows;
  for (const section of Object.values(cells)) {
    for (const values of Object.values(section)) {
      if (values.length !== length)
        throw new Error(`Expected ${length} entries in every cell array.`);
    }
  }
}
