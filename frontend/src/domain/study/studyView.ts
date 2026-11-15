/**
 * Everything a theme presents, derived once from the loaded files (pure, tested).
 * Compositions receive this only when the data exists, so "is it ready?" is a
 * single null check and nothing ever renders placeholder empty arrays as data.
 */
import type { LocatedPoint, Manifest, PointCollection, PointProperties } from '@/data/schema';
import { computeBurnGroups, type BurnGroup } from './burnGroups';
import { computeStudyFigures, type StudyFigure } from './studyFigures';

export interface StudyView {
  manifest: Manifest;
  /** Point properties, in file order. */
  points: PointProperties[];
  /** The same points with their coordinates (point clouds, selection, locators). */
  located: LocatedPoint[];
  /** Headline figures, computed from the data. */
  figures: StudyFigure[];
  /** Burned-point groups (CSV fire_id; not official perimeters), largest first. */
  burnGroups: BurnGroup[];
  /** First and last fire year in the study, or null when no point burned. */
  fireYearRange: [number, number] | null;
}

/** Where loading stands. `retry` lives with the error it recovers from. */
export type StudyLoad =
  | { status: 'loading' }
  | { status: 'error'; message: string; retry: () => void }
  | { status: 'ready' };

export function buildStudyView(data: { manifest: Manifest; points: PointCollection }): StudyView {
  const located: LocatedPoint[] = data.points.features.map((f) => ({
    ...f.properties,
    lon: f.geometry.coordinates[0],
    lat: f.geometry.coordinates[1],
  }));
  const points = data.points.features.map((f) => f.properties);
  const years = data.manifest.fire_years;
  return {
    manifest: data.manifest,
    points,
    located,
    figures: computeStudyFigures(data.manifest, points),
    burnGroups: computeBurnGroups(located),
    fireYearRange: years.length ? [Math.min(...years), Math.max(...years)] : null,
  };
}
