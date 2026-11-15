import { intersect } from '@turf/intersect';
import { area } from '@turf/area';
import { feature, featureCollection } from '@turf/helpers';
import type { Polygon, MultiPolygon } from 'geojson';
import { mapHref } from '@/app/route';
import type { CatalogFire } from './contracts';

export function boundaryOverlap(fire: CatalogFire, boundary: Polygon | null): number | null {
  if (!boundary) return 1;
  if (!fire.perimeter) return null;
  const total = area(fire.perimeter);
  if (!total) return null;
  const overlap = intersect(
    featureCollection<Polygon | MultiPolygon>([feature(fire.perimeter), feature(boundary)]),
  );
  return overlap ? Math.min(1, area(overlap) / total) : 0;
}

export function canAnalyze({
  drawing,
  processing,
  summer,
  mock,
  selectedCoverage,
  matchesBoundary,
}: {
  drawing: boolean;
  processing: boolean;
  summer: number | undefined;
  mock: boolean;
  selectedCoverage: number | null;
  matchesBoundary: boolean;
}) {
  return (
    !drawing &&
    !processing &&
    summer !== undefined &&
    matchesBoundary &&
    (mock || (selectedCoverage !== null && selectedCoverage > 0))
  );
}

export function precomputedHref(resultId: string) {
  return mapHref({ mode: 'examples', presentation: 'fire', fireId: resultId });
}
