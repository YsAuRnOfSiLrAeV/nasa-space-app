import { z } from 'zod';
import type { FireResult } from './fireSchema';
import type { RecoveryFile } from './recoverySchema';

/** An explicit scientific association, never inferred from a nearby date or name.
 * Sampling-group observations describe sampled locations, not a whole perimeter.
 */
export const FireObservationIndexSchema = z.object({
  schema_version: z.literal(1),
  links: z
    .array(
      z.object({
        fire_id: z.string().min(1),
        fire_year: z.number().int().positive(),
        group_id: z.string().regex(/^[a-zA-Z0-9_-]+$/),
        basis: z.string().trim().min(1),
      }),
    )
    .superRefine((links, ctx) => {
      if (new Set(links.map((link) => link.fire_id)).size !== links.length)
        ctx.addIssue({ code: 'custom', message: 'Each fire must have one observation mapping.' });
    }),
});

export type FireObservationLink = z.infer<typeof FireObservationIndexSchema>['links'][number];
export interface FireObservations {
  link: FireObservationLink;
  record: RecoveryFile;
}

/** Defensive cross-checks catch accidental links between different fires.
 * Geographic overlap is a sanity check; the recorded association basis is still
 * required because overlap alone cannot establish that the sampled fire matches.
 */
export function validateFireObservations(
  result: FireResult,
  link: FireObservationLink,
  record: RecoveryFile,
) {
  if (
    link.fire_id !== result.fire.id ||
    link.fire_year !== result.fire.year ||
    record.fire_year !== result.fire.year ||
    record.group_id !== link.group_id
  )
    throw new Error('The optical observation mapping does not match this fire and fire year.');
  const corners = result.map_grid.corners_lonlat;
  const west = Math.min(...corners.map((p) => p[0]));
  const east = Math.max(...corners.map((p) => p[0]));
  const south = Math.min(...corners.map((p) => p[1]));
  const north = Math.max(...corners.map((p) => p[1]));
  const [w, s, e, n] = record.bbox;
  if (w >= e || s >= n || w >= east || e <= west || s >= north || n <= south)
    throw new Error('The optical observation footprint does not overlap this fire grid.');
}
