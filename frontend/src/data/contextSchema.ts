import { z } from 'zod';

const Position = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);
const Ring = z.array(Position).min(4);
const WaterGeometry = z.discriminatedUnion('type', [
  z.object({ type: z.literal('Polygon'), coordinates: z.array(Ring) }),
  z.object({ type: z.literal('MultiPolygon'), coordinates: z.array(z.array(Ring)) }),
]);
export const WaterFeaturesSchema = z.object({
  type: z.literal('FeatureCollection'),
  features: z.array(
    z.object({
      type: z.literal('Feature'),
      geometry: WaterGeometry,
      properties: z.object({
        WATERBODY_POLY_ID: z.number(),
        GNIS_NAME_1: z.string().nullable(),
        AREA_HA: z.number().nonnegative(),
      }),
    }),
  ),
});

export const CanadianContextSchema = z.object({
  schema_version: z.literal(1),
  fire_id: z.string(),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  fetched_at: z.iso.datetime(),
  source: z.object({
    name: z.string(),
    url: z.url(),
    service: z.url(),
    attribution: z.string(),
    licence: z.url(),
    minimum_area_ha: z.number().nonnegative(),
  }),
  water: WaterFeaturesSchema,
});
export type CanadianContext = z.infer<typeof CanadianContextSchema>;
