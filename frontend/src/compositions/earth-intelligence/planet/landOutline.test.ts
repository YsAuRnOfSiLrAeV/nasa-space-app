import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseLandRings } from './landOutline';

const file = resolve(import.meta.dirname, '../../../../data/reference/ne_110m_land.geojson');

describe('land outline', () => {
  it('reads every Natural Earth land ring as lon/lat pairs', () => {
    const rings = parseLandRings(JSON.parse(readFileSync(file, 'utf8')));
    expect(rings.length).toBeGreaterThan(100);
    for (const ring of rings) {
      expect(ring.length).toBeGreaterThanOrEqual(4);
      for (const [lon, lat] of ring) {
        expect(Math.abs(lon)).toBeLessThanOrEqual(180);
        expect(Math.abs(lat)).toBeLessThanOrEqual(90);
      }
    }
  });

  it('keeps holes and multipolygons, drops extra coordinates', () => {
    const square = [
      [0, 0, 5],
      [1, 0],
      [1, 1],
      [0, 0],
    ];
    const rings = parseLandRings({
      type: 'FeatureCollection',
      features: [
        { geometry: { type: 'Polygon', coordinates: [square, square] } },
        { geometry: { type: 'MultiPolygon', coordinates: [[square], [square]] } },
      ],
    });
    expect(rings).toHaveLength(4);
    expect(rings[0]![0]).toEqual([0, 0]);
  });

  it('rejects files that are not land polygons', () => {
    expect(() =>
      parseLandRings({
        type: 'FeatureCollection',
        features: [{ geometry: { type: 'Point', coordinates: [0, 0] } }],
      }),
    ).toThrow();
  });
});
