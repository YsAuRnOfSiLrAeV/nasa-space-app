import type { Polygon, MultiPolygon } from 'geojson';

type Bounds = [number, number, number, number];
export function geometryBounds(geometry: Polygon | MultiPolygon): Bounds {
  const bounds: Bounds = [Infinity, Infinity, -Infinity, -Infinity];
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  for (const polygon of polygons)
    for (const ring of polygon)
      for (const point of ring) {
        bounds[0] = Math.min(bounds[0], point[0]!);
        bounds[1] = Math.min(bounds[1], point[1]!);
        bounds[2] = Math.max(bounds[2], point[0]!);
        bounds[3] = Math.max(bounds[3], point[1]!);
      }
  return bounds;
}

/** Safe broad-phase pruning only. Original rings/holes are passed unchanged to exact intersection. */
export function nearbyPolygons(
  geometry: Polygon | MultiPolygon,
  boundary: Bounds,
): Polygon | MultiPolygon | null {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  const nearby = polygons.filter((coordinates) => {
    const bounds = geometryBounds({ type: 'Polygon', coordinates });
    return (
      bounds[0] < boundary[2] &&
      bounds[2] > boundary[0] &&
      bounds[1] < boundary[3] &&
      bounds[3] > boundary[1]
    );
  });
  return nearby.length ? { type: 'MultiPolygon', coordinates: nearby } : null;
}
