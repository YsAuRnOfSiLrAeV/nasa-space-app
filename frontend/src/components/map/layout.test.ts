import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ManifestSchema, PointCollectionSchema } from '@/data/schema';
import { computeBurnGroups } from '@/domain/study/burnGroups';
import { computeStudyFigures } from '@/domain/study/studyFigures';
import {
  formatExtent,
  formatLat,
  formatLon,
  formatLonLat,
  graticuleStep,
  graticuleTicks,
} from '@/domain/globe/graticule';
import { insetsFromRects } from './occluders';

describe('insetsFromRects', () => {
  const W = 1200;
  const H = 800;
  it('classifies rails, bars and columns by the edge they touch', () => {
    const insets = insetsFromRects(
      [
        { top: 0, left: 0, right: W, bottom: 56 }, // top rail
        { top: 712, left: 0, right: W, bottom: H }, // bottom readout bar
        { top: 56, left: 0, right: 360, bottom: 712 }, // left column
      ],
      W,
      H,
    );
    expect(insets).toEqual({ top: 56, bottom: 88, left: 360, right: 0 });
  });

  it('ignores floating cards and empty rects', () => {
    expect(
      insetsFromRects(
        [
          { top: 100, left: 400, right: 700, bottom: 300 },
          { top: 0, left: 0, right: 0, bottom: 0 },
        ],
        W,
        H,
      ),
    ).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });

  it('honours an explicit edge hint for corner blocks', () => {
    expect(
      insetsFromRects([{ top: 20, left: 24, right: 600, bottom: 220, edge: 'top' }], W, H),
    ).toEqual({ top: 220, right: 0, bottom: 0, left: 0 });
  });

  it('treats a full-width mobile sheet as a bottom inset', () => {
    expect(insetsFromRects([{ top: 400, left: 0, right: 390, bottom: 844 }], 390, 844).bottom).toBe(
      444,
    );
  });
});

describe('graticule', () => {
  it('chooses a nice step for the span', () => {
    expect(graticuleStep(3)).toBe(0.5);
    expect(graticuleStep(0.8)).toBe(0.25);
    expect(graticuleStep(40)).toBe(10);
  });

  it('lists ticks strictly inside the range without float drift', () => {
    expect(graticuleTicks(49.56, 51.5, 0.5)).toEqual([50, 50.5, 51]);
    expect(graticuleTicks(-95.5, -92.5, 1)).toEqual([-95, -94, -93]);
  });

  it('formats hemispheres with precision matched to the step', () => {
    expect(formatLat(50.5, 0.5)).toBe('50.5°N');
    expect(formatLon(-94, 1)).toBe('94°W');
    expect(formatLat(-12.345, 0.01)).toBe('12.35°S');
  });

  it('formats a place latitude-first and an extent south–north, west–east', () => {
    expect(formatLonLat([-93.904, 51.4])).toBe('51.40°N 93.90°W');
    expect(formatLonLat([-93.9, 51.4], 1)).toBe('51°N 94°W');
    expect(formatExtent([-94.8, 50.9, -92.6, 52.1])).toBe('50.90°N–52.10°N · 94.80°W–92.60°W');
  });
});

describe('computeStudyFigures (real data)', () => {
  const read = (p: string) =>
    JSON.parse(readFileSync(resolve(import.meta.dirname, '../../../public/data', p), 'utf8'));
  const manifest = ManifestSchema.parse(read('manifest.json'));
  const points = PointCollectionSchema.parse(read('points.geojson')).features.map(
    (f) => f.properties,
  );

  it('derives every figure from the data', () => {
    const byId = Object.fromEntries(computeStudyFigures(manifest, points).map((f) => [f.id, f]));
    expect(byId.points?.value).toBe('282');
    expect(byId.burnGroups?.value).toBe('10');
    expect(byId.fireYears?.value).toBe('2002–2011');
    expect(byId.nisarRho?.value).toBe('0.44');
    expect(byId.extent?.value).toBe('49.56°N–51.50°N');
  });
});

describe('computeBurnGroups (real data)', () => {
  const read = (p: string) =>
    JSON.parse(readFileSync(resolve(import.meta.dirname, '../../../public/data', p), 'utf8'));
  const features = PointCollectionSchema.parse(read('points.geojson')).features;
  const groups = computeBurnGroups(
    features.map((f) => ({
      ...f.properties,
      lon: f.geometry.coordinates[0],
      lat: f.geometry.coordinates[1],
    })),
  );

  it('summarises every burned group and nothing else', () => {
    expect(groups).toHaveLength(10);
    expect(groups.reduce((n, g) => n + g.count, 0)).toBe(132);
    expect(new Set(groups.map((g) => g.fireYear))).toEqual(new Set([2002, 2003, 2006, 2011]));
  });

  it('names groups by fire year, with a letter where a year has several (A = most points)', () => {
    const labels = groups.map((g) => g.label);
    expect(new Set(labels).size).toBe(groups.length);
    expect(labels).toContain('2003');
    expect(groups[0]!.label).toBe('2011 A');
    const of2011 = groups.filter((g) => g.fireYear === 2011);
    expect(of2011.map((g) => g.label)).toEqual(['2011 A', '2011 B', '2011 C', '2011 D']);
    expect(of2011.map((g) => g.count)).toEqual(
      [...of2011.map((g) => g.count)].sort((a, b) => b - a),
    );
  });

  it('sorts by size and keeps centroids inside the study extent', () => {
    expect(groups[0]!.count).toBe(34);
    for (const g of groups) {
      expect(g.centroid[0]).toBeGreaterThan(-95.6);
      expect(g.centroid[0]).toBeLessThan(-92.4);
      expect(g.centroid[1]).toBeGreaterThan(49.5);
      expect(g.centroid[1]).toBeLessThan(51.6);
      expect(g.shareTall).toBeGreaterThanOrEqual(0);
      expect(g.shareTall).toBeLessThanOrEqual(1);
    }
  });
});
