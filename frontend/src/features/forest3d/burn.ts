/**
 * The real burn perimeter, as a shape on the illustrative block. Pure and DOM-free.
 *
 * The perimeter (longitude/latitude) is projected flat around its own centre, scaled so
 * its longer side fills `fill` of the block, and drawn north-up. Its shape is real; its
 * scale is not (a 1,000 ha fire and a 17,000 ha fire both fit the block), so the real
 * width in km is kept for the caption.
 */

export type ScenePoint = readonly [number, number];
/** One polygon: an outer ring, then holes (unburned islands). Scene units, [x, z]. */
export type ScenePolygon = readonly (readonly ScenePoint[])[];

export interface BurnShape {
  polygons: readonly ScenePolygon[];
  /** Real width and height of the perimeter, km. */
  widthKm: number;
  heightKm: number;
}

/** A GeoJSON Polygon or MultiPolygon: all this module needs of it. */
export interface PerimeterLike {
  type: 'Polygon' | 'MultiPolygon';
  coordinates: unknown;
}

const KM_PER_DEG = 110.57;
/** Polygons and holes smaller than this (square scene units) are specks, not shape. */
const MIN_AREA = 1.5;
/** Outline simplification tolerance, scene units (about 0.3 m of block per unit… i.e. invisible). */
const TOLERANCE = 0.25;

const ringArea = (ring: readonly ScenePoint[]) => {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++)
    sum += (ring[j]![0] + ring[i]![0]) * (ring[j]![1] - ring[i]![1]);
  return Math.abs(sum / 2);
};

/** Douglas–Peucker on an open polyline. */
function simplify(points: readonly ScenePoint[], tolerance: number): ScenePoint[] {
  if (points.length < 3) return [...points];
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ax, az] = points[a]!;
    const [bx, bz] = points[b]!;
    const dx = bx - ax;
    const dz = bz - az;
    const len = Math.hypot(dx, dz) || 1e-9;
    let far = -1;
    let max = tolerance;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dz * (points[i]![0] - ax) - dx * (points[i]![1] - az)) / len;
      if (d > max) {
        max = d;
        far = i;
      }
    }
    if (far >= 0) {
      keep[far] = 1;
      stack.push([a, far], [far, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/**
 * Douglas–Peucker on a closed ring. A closed ring has the same first and last point, so it
 * is split at its farthest point first; each half is then an ordinary open polyline.
 */
function simplifyRing(ring: readonly ScenePoint[], tolerance: number): ScenePoint[] {
  const open = ring.slice(0, -1);
  if (open.length < 4) return [...ring];
  let far = 1;
  let max = -1;
  for (let i = 1; i < open.length; i++) {
    const d = Math.hypot(open[i]![0] - open[0]![0], open[i]![1] - open[0]![1]);
    if (d > max) {
      max = d;
      far = i;
    }
  }
  const first = simplify(open.slice(0, far + 1), tolerance);
  const second = simplify([...open.slice(far), open[0]!], tolerance);
  return [...first, ...second.slice(1)];
}

/** The perimeter as a block-sized shape, or null if it has no usable outline. */
export function burnShapeFromPerimeter(
  perimeter: PerimeterLike | null | undefined,
  blockSize: number,
  fill = 0.8,
): BurnShape | null {
  if (!perimeter) return null;
  const polygons: number[][][][] =
    perimeter.type === 'Polygon'
      ? [perimeter.coordinates as number[][][]]
      : (perimeter.coordinates as number[][][][]);
  let west = Infinity;
  let east = -Infinity;
  let south = Infinity;
  let north = -Infinity;
  for (const polygon of polygons)
    for (const [lon, lat] of polygon[0] ?? []) {
      west = Math.min(west, lon!);
      east = Math.max(east, lon!);
      south = Math.min(south, lat!);
      north = Math.max(north, lat!);
    }
  if (!Number.isFinite(west) || east <= west || north <= south) return null;
  const lat0 = (south + north) / 2;
  const lon0 = (west + east) / 2;
  const kmX = Math.cos((lat0 * Math.PI) / 180) * KM_PER_DEG;
  const widthKm = (east - west) * kmX;
  const heightKm = (north - south) * KM_PER_DEG;
  const scale = (fill * blockSize) / Math.max(widthKm, heightKm);
  const project = (p: number[]): ScenePoint => [
    (p[0]! - lon0) * kmX * scale,
    -(p[1]! - lat0) * KM_PER_DEG * scale,
  ];

  const shaped: ScenePolygon[] = [];
  for (const polygon of polygons) {
    const rings = polygon
      .map((ring) => simplifyRing(ring.map(project), TOLERANCE))
      .filter((ring) => ring.length >= 4);
    const outer = rings[0];
    if (!outer || ringArea(outer) < MIN_AREA) continue;
    shaped.push([outer, ...rings.slice(1).filter((hole) => ringArea(hole) >= MIN_AREA)]);
  }
  if (!shaped.length) return null;
  return { polygons: shaped, widthKm, heightKm };
}

function insideRing(x: number, z: number, ring: readonly ScenePoint[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i]!;
    const [xj, zj] = ring[j]!;
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/** Whether a scene point is inside the burn: inside an outer ring and outside its holes. */
export function createBurnMask(shape: BurnShape): (x: number, z: number) => boolean {
  const boxes = shape.polygons.map((polygon) => {
    let x0 = Infinity;
    let x1 = -Infinity;
    let z0 = Infinity;
    let z1 = -Infinity;
    for (const [x, z] of polygon[0]!) {
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      z0 = Math.min(z0, z);
      z1 = Math.max(z1, z);
    }
    return { x0, x1, z0, z1 };
  });
  return (x, z) =>
    shape.polygons.some((polygon, i) => {
      const b = boxes[i]!;
      if (x < b.x0 || x > b.x1 || z < b.z0 || z > b.z1) return false;
      if (!insideRing(x, z, polygon[0]!)) return false;
      return !polygon.slice(1).some((hole) => insideRing(x, z, hole));
    });
}

/** Every ring (outer rings and holes) as a closed polyline, for drawing the outline. */
export function outlineRings(shape: BurnShape): ScenePoint[][] {
  return shape.polygons.flatMap((polygon) => polygon.map((ring) => [...ring]));
}
