import { z } from 'zod';

// Contract from DELIVERABLES, tab 1. Fractions in summaries and percentages in
// cells intentionally have different units. Missing observations remain null.
const Fraction = z.number().min(0).max(1);
const RecoveryFraction = z.number().nonnegative();
const Percentage = z.number().min(0).max(100);
const Position = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);
const Name = z.object({ en: z.string().min(1), uk: z.string() });
const Year = z.number().int().positive();

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
      area_recovered_80pct: Fraction.nullable(),
      year_80pct: Year.nullable(),
      result: FireAssetPath,
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
    nisar: z.object({ date: z.iso.date(), fire_covered: Fraction.nullable() }).nullish(),
    sentinel1: z
      .object({ from: z.iso.date(), to: z.iso.date(), scenes: z.number().int().nonnegative() })
      .nullish(),
    sentinel2: z.object({ from: z.iso.date(), to: z.iso.date() }).nullish(),
  }),
  map_grid: z.object({
    columns: z.number().int().positive(),
    rows: z.number().int().positive(),
    cell_size_m: z.number().positive(),
    corners_lonlat: z.tuple([Position, Position, Position, Position]),
  }),
  neighbour_forest: z
    .object({ height_m: z.number().positive().nullable(), source: z.string() })
    .nullable(),
  model_result: z.object({
    model_version: z.string(),
    region: z.string(),
    recovery_today_avg: RecoveryFraction.nullable(),
    area_recovered_80pct: Fraction.nullable(),
    stage_share: z.tuple([Fraction, Fraction, Fraction]).nullable(),
    error_vs_lidar_pct: z.number().nonnegative().nullable(),
  }),
  growth_forecast: z
    .object({
      method: z.string(),
      tau: z.number().positive().nullable(),
      years_to_80pct: z.number().nonnegative().nullable(),
      year_80pct: Year.nullable(),
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
  result: FireResult;
  cells: FireCells;
  opticalImageUrl: string | null;
}

export function validateFireCells(cells: FireCells, grid: FireResult['map_grid']) {
  const length = grid.columns * grid.rows;
  for (const section of Object.values(cells)) {
    for (const values of Object.values(section)) {
      if (values.length !== length)
        throw new Error(`Expected ${length} entries in every cell array.`);
    }
  }
}
