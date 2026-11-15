import type { PointCollection } from './schema';

export interface StudyPoint {
  id: string;
  lon: number;
  lat: number;
}
export const OPTICAL_REFERENCE_RADIUS_KM = 40;

/** The same burned and nearby reference selection for both optical pipelines. */
export function opticalGroup(collection: PointCollection, groupId: string) {
  const burned: StudyPoint[] = [];
  const unburned: StudyPoint[] = [];
  let fireYear: number | null = null;
  for (const feature of collection.features) {
    const properties = feature.properties;
    const point = {
      id: properties.point_id,
      lon: feature.geometry.coordinates[0],
      lat: feature.geometry.coordinates[1],
    };
    if (properties.status === 'burned' && properties.group_id === groupId) {
      burned.push(point);
      fireYear = properties.fire_year;
    } else if (properties.status === 'unburned') unburned.push(point);
  }
  if (!burned.length || fireYear === null) throw new Error(`No burned points in group ${groupId}`);
  const lat0 = burned.reduce((sum, point) => sum + point.lat, 0) / burned.length;
  const lon0 = burned.reduce((sum, point) => sum + point.lon, 0) / burned.length;
  const kmX = 111.32 * Math.cos((lat0 * Math.PI) / 180);
  const distance = (point: StudyPoint) =>
    Math.hypot((point.lon - lon0) * kmX, (point.lat - lat0) * 111.32);
  const reference = unburned
    .map((point) => ({ point, distance: distance(point) }))
    .filter((entry) => entry.distance <= OPTICAL_REFERENCE_RADIUS_KM)
    .sort((a, b) => a.distance - b.distance || a.point.id.localeCompare(b.point.id))
    .map((entry) => entry.point);
  const halfKm =
    Math.max(
      ...burned.map((point) =>
        Math.max(Math.abs(point.lon - lon0) * kmX, Math.abs(point.lat - lat0) * 111.32),
      ),
    ) + 2;
  const r4 = (value: number) => Math.round(value * 1e4) / 1e4;
  const bbox: [number, number, number, number] = [
    r4(lon0 - halfKm / kmX),
    r4(lat0 - halfKm / 111.32),
    r4(lon0 + halfKm / kmX),
    r4(lat0 + halfKm / 111.32),
  ];
  const extent: [number, number, number, number] = [
    Math.min(...burned.map((point) => point.lon)),
    Math.min(...burned.map((point) => point.lat)),
    Math.max(...burned.map((point) => point.lon)),
    Math.max(...burned.map((point) => point.lat)),
  ];
  return { fireYear, burned, reference, bbox, extent };
}
