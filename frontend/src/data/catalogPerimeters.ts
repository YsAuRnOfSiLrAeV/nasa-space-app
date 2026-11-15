import { z } from 'zod';
import { FirePerimeterSchema } from './fireSchema';

export const CatalogPerimetersSchema = z
  .object({
    type: z.literal('FeatureCollection'),
    features: z.array(
      z.object({
        type: z.literal('Feature'),
        properties: z.object({ id: z.string(), year: z.number().int(), region: z.string() }),
        geometry: FirePerimeterSchema,
      }),
    ),
  })
  .refine(
    (collection) =>
      new Set(collection.features.map((feature) => feature.properties.id)).size ===
      collection.features.length,
    'Duplicate catalog perimeter identities',
  );
export type CatalogPerimeters = z.infer<typeof CatalogPerimetersSchema>;
