import { intersect } from '@turf/intersect';
import { area } from '@turf/area';
import { union } from '@turf/union';
import { featureCollection, feature } from '@turf/helpers';
import type { Polygon, MultiPolygon } from 'geojson';
import type { Zones } from './contracts';

export function coverage(polygon: Polygon | MultiPolygon, zones: Zones | null): number | null {
  if (!zones) return null;
  const total = area(polygon);
  if (!total) throw new Error('Draw a polygon with non-zero area.');
  const supported = zones.features.filter((zone) => zone.properties.supported);
  if (!supported.length) return 0;
  const merged =
    supported.length === 1
      ? feature(supported[0]!.geometry)
      : union(
          featureCollection(
            supported.map((zone) => feature<Polygon | MultiPolygon>(zone.geometry)),
          ),
        );
  if (!merged) return 0;
  const overlap = intersect(
    featureCollection<Polygon | MultiPolygon>([feature<Polygon | MultiPolygon>(polygon), merged]),
  );
  return overlap ? Math.min(1, area(overlap) / total) : 0;
}

export function drawingPolygon(points: [number, number][]): Polygon {
  if (points.length < 3) throw new Error('Add at least three vertices.');
  const ring = [...points, points[0]!];
  const cross = (start: number[], end: number[], point: number[]) =>
    (end[0]! - start[0]!) * (point[1]! - start[1]!) -
    (end[1]! - start[1]!) * (point[0]! - start[0]!);
  for (let first = 0; first < points.length; first++) {
    for (let second = first + 2; second < points.length; second++) {
      if (first === 0 && second === points.length - 1) continue;
      const start = ring[first]!;
      const end = ring[first + 1]!;
      const otherStart = ring[second]!;
      const otherEnd = ring[second + 1]!;
      if (
        Math.max(Math.min(start[0]!, end[0]!), Math.min(otherStart[0]!, otherEnd[0]!)) <=
          Math.min(Math.max(start[0]!, end[0]!), Math.max(otherStart[0]!, otherEnd[0]!)) &&
        Math.max(Math.min(start[1]!, end[1]!), Math.min(otherStart[1]!, otherEnd[1]!)) <=
          Math.min(Math.max(start[1]!, end[1]!), Math.max(otherStart[1]!, otherEnd[1]!)) &&
        cross(start, end, otherStart) * cross(start, end, otherEnd) <= 0 &&
        cross(otherStart, otherEnd, start) * cross(otherStart, otherEnd, end) <= 0
      )
        throw new Error('Boundary crosses or touches itself. Draw a simple polygon.');
    }
  }
  const polygon: Polygon = { type: 'Polygon', coordinates: [ring] };
  if (!area(polygon)) throw new Error('Draw a boundary with non-zero area.');
  return polygon;
}
