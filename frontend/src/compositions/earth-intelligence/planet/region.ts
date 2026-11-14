/**
 * Study-region geometry, DOM-free (pure, tested): the bounding box as a ring on
 * the sphere, and its extent as text. Drawn by `drawStudyRegion.ts`.
 */
import { formatLat, formatLon } from '@/components/map/graticule';

/** [west, south, east, north] in degrees. */
export type BBox = readonly [number, number, number, number];

/** The bounding box as a closed ring of [lon, lat], densified so its edges follow the sphere. */
export function boxRing([w, s, e, n]: BBox, step = 0.25): [number, number][] {
  const count = (a: number, b: number) => Math.max(1, Math.ceil(Math.abs(b - a) / step));
  const kx = count(w, e);
  const ky = count(s, n);
  const ring: [number, number][] = [];
  for (let i = 0; i <= kx; i++) ring.push([w + ((e - w) * i) / kx, s]);
  for (let i = 1; i <= ky; i++) ring.push([e, s + ((n - s) * i) / ky]);
  for (let i = 1; i <= kx; i++) ring.push([e - ((e - w) * i) / kx, n]);
  for (let i = 1; i <= ky; i++) ring.push([w, n - ((n - s) * i) / ky]);
  return ring;
}

/** The study region's extent as two lines of text, latitude first. */
export function extentLines([w, s, e, n]: BBox): [string, string] {
  return [
    `${formatLat(s, 0.01)} – ${formatLat(n, 0.01)}`,
    `${formatLon(w, 0.01)} – ${formatLon(e, 0.01)}`,
  ];
}
