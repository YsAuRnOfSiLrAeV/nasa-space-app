import { z } from 'zod';
import { FirePerimeterSchema } from './fireSchema';

// BUNDLE_FORMAT.md: distinct provider layers, not pipeline confidence codes 0/1/2.
export const ApplicabilityZonesSchema = z.object({
  type: z.literal('FeatureCollection'),
  features: z.array(
    z.object({
      type: z.literal('Feature'),
      geometry: FirePerimeterSchema,
      properties: z.discriminatedUnion('layer', [
        z
          .object({
            layer: z.literal('model1_region'),
            region: z.string(),
            tier: z.union([z.literal(1), z.literal(2)]),
            status: z.enum(['verified', 'extrapolated']),
            reliability: z.enum(['good', 'moderate', 'low']),
            name_en: z.string(),
            color: z
              .string()
              .regex(/^#[0-9a-fA-F]{6}$/)
              .optional(),
            opacity: z.number().min(0).max(1).optional(),
          })
          .passthrough()
          .refine(
            (properties) => (properties.tier === 1) === (properties.status === 'verified'),
            'Conflicting provider tier and status',
          ),
        z
          .object({
            layer: z.literal('model2_growth'),
            status: z.literal('verified'),
            name_en: z.string(),
          })
          .passthrough(),
        z
          .object({
            layer: z.literal('model2_scenario'),
            status: z.literal('verified'),
            name_en: z.string(),
          })
          .passthrough(),
      ]),
    }),
  ),
});
export type ApplicabilityZones = z.infer<typeof ApplicabilityZonesSchema>;
export type ApplicabilityLayer = ApplicabilityZones['features'][number]['properties']['layer'];
export const APPLICABILITY_LABELS: Record<ApplicabilityLayer, string> = {
  model1_region: 'Model 1 · current forest state',
  model2_growth: 'Model 2 · growth forecast geography',
  model2_scenario: 'Model 2 · fire-severity scenario geography',
};
