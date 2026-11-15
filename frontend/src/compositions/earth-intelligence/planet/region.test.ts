import { describe, expect, it } from 'vitest';
import { boxRing, extentLines } from './region';

const BBOX = [-95.499786, 49.560616, -92.507497, 51.501875] as const;

describe('study region outline', () => {
  it('traces the four true corners, in order, and stays inside the box', () => {
    const ring = boxRing(BBOX);
    expect(ring[0]).toEqual([BBOX[0], BBOX[1]]);
    expect(ring).toContainEqual([BBOX[2], BBOX[1]]);
    expect(ring).toContainEqual([BBOX[2], BBOX[3]]);
    expect(ring).toContainEqual([BBOX[0], BBOX[3]]);
    for (const [lon, lat] of ring) {
      expect(lon).toBeGreaterThanOrEqual(BBOX[0] - 1e-9);
      expect(lon).toBeLessThanOrEqual(BBOX[2] + 1e-9);
      expect(lat).toBeGreaterThanOrEqual(BBOX[1] - 1e-9);
      expect(lat).toBeLessThanOrEqual(BBOX[3] + 1e-9);
    }
  });

  it('densifies long edges so they follow the sphere', () => {
    expect(boxRing(BBOX, 0.25).length).toBeGreaterThan(boxRing(BBOX, 1).length);
  });

  it('labels the extent from the data, latitude first', () => {
    expect(extentLines(BBOX)).toEqual(['49.56°N – 51.50°N', '95.50°W – 92.51°W']);
  });
});
