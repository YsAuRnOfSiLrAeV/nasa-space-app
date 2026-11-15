import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Manifest, PointCollection } from '@/data/schema';
import { buildStudyView } from './studyView';

const ROOT = resolve(import.meta.dirname, '../../..');
const json = <T>(p: string) => JSON.parse(readFileSync(resolve(ROOT, p), 'utf8')) as T;
const manifest = json<Manifest>('public/data/manifest.json');
const points = json<PointCollection>('public/data/points.geojson');

describe('buildStudyView', () => {
  const view = buildStudyView({ manifest, points });

  it('keeps every point, in file order, with and without coordinates', () => {
    expect(view.points).toHaveLength(manifest.counts.points);
    expect(view.located).toHaveLength(manifest.counts.points);
    view.located.forEach((p, i) => {
      const f = points.features[i]!;
      expect(p.point_id).toBe(f.properties.point_id);
      expect(view.points[i]).toBe(f.properties);
      expect([p.lon, p.lat]).toEqual(f.geometry.coordinates);
    });
  });

  it('derives figures and burn groups that agree with the manifest', () => {
    const fig = (id: string) => view.figures.find((f) => f.id === id)?.value;
    expect(fig('points')).toBe(String(manifest.counts.points));
    expect(fig('burnGroups')).toBe(String(manifest.counts.burned_groups));
    expect(view.burnGroups).toHaveLength(manifest.counts.burned_groups);
    expect(view.burnGroups.reduce((n, g) => n + g.count, 0)).toBe(manifest.counts.burned);
  });

  it('gives the fire years as a typed range from the manifest', () => {
    const years = manifest.fire_years;
    expect(view.fireYearRange).toEqual([Math.min(...years), Math.max(...years)]);
    expect(
      buildStudyView({ manifest: { ...manifest, fire_years: [] }, points }).fireYearRange,
    ).toBeNull();
  });

  it('passes the manifest through unchanged', () => {
    expect(view.manifest).toBe(manifest);
  });
});
