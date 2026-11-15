import { z } from 'zod';
import { FireAssetPath, FirePerimeterSchema } from '@/data/fireSchema';

const Position = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);
export const CatalogSchema = z.object({
  countries: z.array(
    z.object({ code: z.string().min(1), name: z.string().min(1), file: FireAssetPath }),
  ),
});
export const CatalogFiresSchema = z
  .array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      year: z.number().int().positive(),
      center: Position,
      perimeter: FirePerimeterSchema.nullable(),
      resultId: z.string().nullable(),
      region: z.string().optional(),
      country: z.string().optional(),
      spatial: z.boolean().optional(),
      perimeterAvailable: z.boolean().optional(),
      timeline: z.boolean().optional(),
      forecast: z.boolean().optional(),
    }),
  )
  .refine(
    (fires) => new Set(fires.map((fire) => fire.id)).size === fires.length,
    'Duplicate fire ids',
  );
export type CatalogFire = z.infer<typeof CatalogFiresSchema>[number];
export function filterCatalog(fires: CatalogFire[], query: string, year: string) {
  return fires.filter(
    (fire) =>
      query
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .every((term) =>
          `${fire.id} ${fire.name} ${fire.year} ${fire.region ?? ''} ${fire.country ?? ''}`
            .toLowerCase()
            .includes(term),
        ) &&
      (!year || String(fire.year) === year),
  );
}
export const ZonesSchema = z.object({
  type: z.literal('FeatureCollection'),
  features: z.array(
    z.object({
      type: z.literal('Feature'),
      geometry: FirePerimeterSchema,
      properties: z.object({ label: z.string(), supported: z.boolean() }),
    }),
  ),
});
export type Zones = z.infer<typeof ZonesSchema>;
export const SummersSchema = z.object({ summers: z.array(z.number().int().positive()) });
export const ErrorSchema = z.object({ code: z.string(), message: z.string().optional() });
export const RunSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('pending'),
    id: z.string(),
    step: z.string().optional(),
    progress: z.number().min(0).max(1).optional(),
  }),
  z.object({ status: z.literal('complete'), result: z.string().url() }),
  z.object({ status: z.literal('failed'), code: z.string(), message: z.string().optional() }),
]);
export type Run = z.infer<typeof RunSchema>;
