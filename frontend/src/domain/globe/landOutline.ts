/**
 * Natural Earth 1:110m land polygons (data/reference/ne_110m_land.geojson) as
 * rings of [lon, lat], for the landing globe's landmasses and coastlines.
 * DOM-free, tested. Fetched by `useLandOutline`.
 */
import { z } from 'zod';

const Position = z.tuple([z.number(), z.number()]).rest(z.number());
const Ring = z.array(Position).min(4);

const LandSchema = z.object({
  type: z.literal('FeatureCollection'),
  features: z.array(
    z.object({
      geometry: z.discriminatedUnion('type', [
        z.object({ type: z.literal('Polygon'), coordinates: z.array(Ring) }),
        z.object({ type: z.literal('MultiPolygon'), coordinates: z.array(z.array(Ring)) }),
      ]),
    }),
  ),
});

export type LandRing = [number, number][];

/** Every ring (outer boundaries and holes) of every land polygon, lon/lat only. */
export function parseLandRings(json: unknown): LandRing[] {
  const land = LandSchema.parse(json);
  const rings: LandRing[] = [];
  for (const { geometry } of land.features) {
    const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
    for (const polygon of polygons)
      for (const ring of polygon) rings.push(ring.map(([lon, lat]) => [lon, lat]));
  }
  return rings;
}
