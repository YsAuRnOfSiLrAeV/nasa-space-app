import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { LocatedPoint, Manifest, PointCollection } from '@/data/schema';
import { computeBurnGroups } from '@/components/study/burnGroups';
import { buildCloud, countAtOrAbove, sweepHeight } from './pointCloud';
import { decodeDots, fibonacciSphere, inRings, orthographic } from './sphere';

const ROOT = resolve(import.meta.dirname, '../../..');
const json = <T>(p: string) => JSON.parse(readFileSync(resolve(ROOT, p), 'utf8')) as T;

describe('sphere geometry', () => {
  it('spreads Fibonacci lattice points over the whole sphere', () => {
    const pts = fibonacciSphere(1000);
    expect(pts).toHaveLength(1000);
    for (const [lon, lat] of pts) {
      expect(lon).toBeGreaterThanOrEqual(-180);
      expect(lon).toBeLessThan(180);
      expect(Math.abs(lat)).toBeLessThan(90);
    }
    // Equal-area: mean of sin(lat) ≈ 0, and half the points in each hemisphere.
    const north = pts.filter(([, lat]) => lat > 0).length;
    expect(north).toBe(500);
  });

  it('projects orthographically around the view centre', () => {
    const c = orthographic(-94, 50, -94, 50);
    expect(c.x).toBeCloseTo(0);
    expect(c.y).toBeCloseTo(0);
    expect(c.z).toBeCloseTo(1);
    expect(orthographic(86, -50, -94, 50).z).toBeCloseTo(-1); // antipode
    const east = orthographic(90, 0, 0, 0);
    expect(east.x).toBeCloseTo(1);
    expect(east.z).toBeCloseTo(0);
    expect(orthographic(0, 45, 0, 0).y).toBeLessThan(0); // north is up on screen
  });

  it('tests points against polygon rings (even-odd, holes)', () => {
    const outer = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [0, 0],
    ];
    const hole = [
      [4, 4],
      [6, 4],
      [6, 6],
      [4, 6],
      [4, 4],
    ];
    expect(inRings(2, 2, [outer, hole])).toBe(true);
    expect(inRings(5, 5, [outer, hole])).toBe(false);
    expect(inRings(12, 5, [outer, hole])).toBe(false);
  });
});

describe('land-dots.json (Natural Earth land mask)', () => {
  const file = json<{
    lattice: number;
    count: number;
    lonlat: number[];
    source_file: string;
    source_sha256: string;
  }>('public/data/land-dots.json');

  it('was built from the committed Natural Earth file (hash recorded in the output)', () => {
    const sha = createHash('sha256')
      .update(readFileSync(resolve(ROOT, file.source_file)))
      .digest('hex');
    expect(file.source_sha256).toBe(sha);
  });
  const dots = decodeDots(file.lonlat);
  const near = (lon: number, lat: number, deg: number) =>
    dots.some(([x, y]) => Math.abs(x - lon) < deg && Math.abs(y - lat) < deg);

  it('is consistent and covers about Earth’s land fraction', () => {
    expect(dots).toHaveLength(file.count);
    const share = file.count / file.lattice;
    expect(share).toBeGreaterThan(0.25);
    expect(share).toBeLessThan(0.33);
  });

  it('has land at the study area and none in the open ocean', () => {
    const m = json<Manifest>('public/data/manifest.json');
    const [w, s, e, n] = m.bbox;
    expect(near((w + e) / 2, (s + n) / 2, 3)).toBe(true);
    expect(near(-150, 0, 4)).toBe(false); // central Pacific
    expect(near(-30, 30, 4)).toBe(false); // central Atlantic
  });
});

describe('point cloud', () => {
  const fc = json<PointCollection>('public/data/points.geojson');
  const m = json<Manifest>('public/data/manifest.json');
  const located: LocatedPoint[] = fc.features.map((f) => ({
    ...f.properties,
    lon: f.geometry.coordinates[0],
    lat: f.geometry.coordinates[1],
  }));
  const cloud = buildCloud(located);

  it('keeps every footprint inside the normalised ground plane', () => {
    expect(cloud.pts).toHaveLength(m.counts.points);
    expect(Math.max(cloud.ex, cloud.ez)).toBeCloseTo(1);
    for (const p of cloud.pts) {
      expect(Math.abs(p.x)).toBeLessThanOrEqual(cloud.ex + 1e-9);
      expect(Math.abs(p.z)).toBeLessThanOrEqual(cloud.ez + 1e-9);
    }
  });

  it('reads the plane from the data: at 10 m it matches the ≥10 m stage count', () => {
    expect(countAtOrAbove(cloud.pts, 10)).toBe(m.counts.by_lidar_stage[2]);
    expect(countAtOrAbove(cloud.pts, 0)).toBe(m.counts.points);
  });

  it('sweeps the plane between the ground and the tallest footprint', () => {
    expect(sweepHeight(0, cloud.maxHeightM)).toBeCloseTo(0);
    expect(sweepHeight(Math.PI / 0.35, cloud.maxHeightM)).toBeCloseTo(cloud.maxHeightM);
  });

  it('tags each burned footprint with its burn-scar group, matching the register', () => {
    for (const g of computeBurnGroups(located)) {
      expect(
        cloud.pts.filter((p) => p.groupId === g.id),
        g.id,
      ).toHaveLength(g.count);
    }
    expect(cloud.pts.filter((p) => p.groupId === null)).toHaveLength(m.counts.unburned);
  });

  it('handles an empty dataset', () => {
    expect(buildCloud([]).pts).toEqual([]);
  });
});
