/**
 * Geometry for the forest point cloud (pure, tested).
 * Each GEDI footprint sits at its real position (longitude scaled by cos(latitude)
 * so the ground plane keeps true proportions) and rises to its measured rh98.
 */
import type { LocatedPoint, Stage } from '@/data/schema';

export interface CloudPoint {
  /** Ground position, normalised so the larger horizontal span is [-1, 1]. */
  x: number;
  z: number;
  heightM: number;
  stage: Stage;
  burned: boolean;
  /** Burn-scar group (see burnGroups.ts) for burned footprints; null for unburned reference. */
  groupId: string | null;
}

export interface Cloud {
  pts: CloudPoint[];
  /** Half-extent of the ground plane in normalised units (x: east-west, z: north-south). */
  ex: number;
  ez: number;
  maxHeightM: number;
  /** Real extent in degrees, for labels. */
  lonSpan: number;
  latSpan: number;
}

export function buildCloud(points: LocatedPoint[]): Cloud {
  if (points.length === 0) {
    return { pts: [], ex: 1, ez: 1, maxHeightM: 0, lonSpan: 0, latSpan: 0 };
  }
  let lon0 = Infinity;
  let lon1 = -Infinity;
  let lat0 = Infinity;
  let lat1 = -Infinity;
  let maxH = 0;
  for (const p of points) {
    lon0 = Math.min(lon0, p.lon);
    lon1 = Math.max(lon1, p.lon);
    lat0 = Math.min(lat0, p.lat);
    lat1 = Math.max(lat1, p.lat);
    maxH = Math.max(maxH, p.rh98_m);
  }
  const k = Math.cos((((lat0 + lat1) / 2) * Math.PI) / 180);
  const spanX = (lon1 - lon0) * k;
  const spanZ = lat1 - lat0;
  const half = Math.max(spanX, spanZ, 1e-9) / 2;
  const lonMid = (lon0 + lon1) / 2;
  const latMid = (lat0 + lat1) / 2;
  return {
    pts: points.map((p) => ({
      x: ((p.lon - lonMid) * k) / half,
      // North is "away" from the viewer.
      z: (p.lat - latMid) / half,
      heightM: p.rh98_m,
      stage: p.lidar_stage,
      burned: p.status === 'burned',
      groupId: p.status === 'burned' ? p.group_id : null,
    })),
    ex: spanX / 2 / half,
    ez: spanZ / 2 / half,
    maxHeightM: maxH,
    lonSpan: lon1 - lon0,
    latSpan: lat1 - lat0,
  };
}

/** Footprints whose measured canopy reaches at least `heightM`. */
export function countAtOrAbove(pts: CloudPoint[], heightM: number): number {
  let n = 0;
  for (const p of pts) if (p.heightM >= heightM) n++;
  return n;
}

/** Height of the sweeping reading plane at time t (s): 0 → max → 0, ~18 s period. */
export function sweepHeight(t: number, maxHeightM: number): number {
  return maxHeightM * (0.5 - 0.5 * Math.cos(t * 0.35));
}
