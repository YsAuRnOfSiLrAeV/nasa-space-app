/**
 * Contract for public/data/recovery/<group>.json, written by
 * scripts/fetch-landsat.ts. Optional per group: when the file is absent the
 * Recovery page shows "no imagery loaded".
 */
import { z } from 'zod';

const Bbox = z.tuple([z.number(), z.number(), z.number(), z.number()]);

export const NdviSummarySchema = z.object({
  /** Median over points of each point's median clear-sky summer NDVI. */
  median: z.number().min(-1).max(1),
  /** Points with at least one clear observation that summer. */
  n_points: z.number().int().positive(),
  /** Clear point-scene observations behind the value. */
  n_obs: z.number().int().positive(),
});

export const RecoveryImageSchema = z.object({
  scene_id: z.string(),
  date: z.string(),
  platform: z.string(),
  /** Share of the group's sample points that were clear (0–1) in this scene. */
  clear_share: z.number().min(0).max(1),
  /** Paths relative to public/data. */
  natural: z.string(),
  swir: z.string(),
});

export const RecoveryFileSchema = z
  .object({
    schema_version: z.literal(1),
    group_id: z.string(),
    fire_year: z.number().int(),
    /** Image extent [west, south, east, north], EPSG:4326, square on the ground. */
    bbox: Bbox,
    season: z.object({ from: z.string(), to: z.string() }),
    years: z.tuple([z.number().int(), z.number().int()]),
    reference: z.object({
      point_ids: z.array(z.string()),
      max_distance_km: z.number(),
    }),
    source: z.object({
      collection: z.string(),
      access: z.string(),
      citation: z.string(),
      doi: z.array(z.string()),
      method: z.string().optional(),
      quality_policy: z.string().optional(),
    }),
    /** Every scene that was sampled, with the share of group points that were clear. */
    scenes: z.array(
      z.object({
        id: z.string(),
        date: z.string(),
        platform: z.string(),
        clear_share: z.number().min(0).max(1),
      }),
    ),
    /** At most one image per year: the clearest usable scene. */
    images: z.array(RecoveryImageSchema),
    /** One row per year in `years`; null where no clear observation exists. */
    ndvi: z.array(
      z.object({
        year: z.number().int(),
        platforms: z.array(z.string()),
        burned: NdviSummarySchema.nullable(),
        reference: NdviSummarySchema.nullable(),
        quality: z
          .object({
            accepted: z.number().int().nonnegative(),
            rejected: z.number().int().nonnegative(),
            missing: z.number().int().nonnegative(),
          })
          .optional(),
      }),
    ),
  })
  .superRefine((file, ctx) => {
    if (file.years[0] > file.years[1])
      ctx.addIssue({
        code: 'custom',
        path: ['years'],
        message: 'Observation years must be ordered',
      });
    const seen = new Set<number>();
    for (const row of file.ndvi) {
      if (seen.has(row.year) || row.year < file.years[0] || row.year > file.years[1]) {
        ctx.addIssue({
          code: 'custom',
          path: ['ndvi'],
          message: 'Observation years must be unique and within the record bounds',
        });
      }
      seen.add(row.year);
    }
  });

export type RecoveryFile = z.infer<typeof RecoveryFileSchema>;
export type RecoveryImage = z.infer<typeof RecoveryImageSchema>;
export type NdviYear = RecoveryFile['ndvi'][number];
