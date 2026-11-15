/**
 * The real burn perimeter, as a shape on the illustrative block. Pure and DOM-free.
 *
 * The perimeter (longitude/latitude) is projected flat around its own centre, scaled to
 * fill the block, and drawn north-up. Its shape is real; its scale is not (a 1,000 ha fire
 * and a 17,000 ha fire fill the same block), so what a block stands for in km is kept for
 * the caption.
 */

export type ScenePoint = readonly [number, number];
/** One polygon: an outer ring, then holes (unburned islands). Scene units, [x, z]. */
export type ScenePolygon = readonly (readonly ScenePoint[])[];

export interface BurnShape {
  polygons: readonly ScenePolygon[];
  /** Real width and height of the perimeter, km. */
  widthKm: number;
  heightKm: number;
  /** How many real km the block's side stands for. */
  blockKm: number;
  /** Side of the block that holds the whole burn, scene units (the base size, or larger). */
  blockSize: number;
}

/** A GeoJSON Polygon or MultiPolygon: all this module needs of it. */
export interface PerimeterLike {
  type: 'Polygon' | 'MultiPolygon';
  coordinates: unknown;
}

const KM_PER_DEG = 110.57;
/** Polygons and holes smaller than this (square scene units) are specks, not shape. */
const MIN_AREA = 1.5;
/** Room kept between the burn and the block's edge, scene units. */
const EDGE_MARGIN = 6;
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

/**
 * The perimeter as a shape on the block, or null if it has no usable outline.
 *
 * Scaled so the burn covers about `targetShare` of a base-sized block, so the growth you
 * scrub through is visible. A thin, winding fire then reaches well past that block, so the
 * block grows to hold all of it (never beyond `maxBlock`; a longer fire is shrunk instead).
 * Centred on the burn's own centre of mass.
 */
export function burnShapeFromPerimeter(
  perimeter: PerimeterLike | null | undefined,
  blockSize: number,
  { targetShare = 0.3, maxBlock = 240 }: { targetShare?: number; maxBlock?: number } = {},
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
  // Kilometres from the bounding-box centre, north up (z grows southwards).
  const km = (p: number[]): ScenePoint => [(p[0]! - lon0) * kmX, -(p[1]! - lat0) * KM_PER_DEG];

  // Burned area and its centre of mass (outer rings minus holes), in km.
  let area = 0;
  let cx = 0;
  let cz = 0;
  for (const polygon of polygons)
    polygon.forEach((ring, index) => {
      const pts = ring.map(km);
      let a = 0;
      let mx = 0;
      let mz = 0;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const cross = pts[j]![0] * pts[i]![1] - pts[i]![0] * pts[j]![1];
        a += cross;
        mx += (pts[j]![0] + pts[i]![0]) * cross;
        mz += (pts[j]![1] + pts[i]![1]) * cross;
      }
      const sign = index === 0 ? 1 : -1;
      area += (sign * Math.abs(a)) / 2;
      const orient = a < 0 ? -1 : 1;
      cx += (sign * orient * mx) / 6;
      cz += (sign * orient * mz) / 6;
    });
  if (!(area > 0)) return null;
  const centre: ScenePoint = [cx / area, cz / area];

  // How far the burn reaches from its centre of mass, km: the block must hold all of it.
  let reach = 0;
  for (const polygon of polygons)
    for (const p of polygon[0] ?? []) {
      const [x, z] = km(p);
      reach = Math.max(reach, Math.abs(x - centre[0]), Math.abs(z - centre[1]));
    }
  let scale = Math.sqrt((targetShare * blockSize * blockSize) / area);
  let size = Math.max(blockSize, 2 * (reach * scale + EDGE_MARGIN));
  if (size > maxBlock) {
    // Very long fires: shrink the shape rather than grow the block without limit.
    scale = (maxBlock / 2 - EDGE_MARGIN) / reach;
    size = maxBlock;
  }
  const project = (p: number[]): ScenePoint => {
    const [x, z] = km(p);
    return [(x - centre[0]) * scale, (z - centre[1]) * scale];
  };

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
  return { polygons: shaped, widthKm, heightKm, blockKm: size / scale, blockSize: size };
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
