/**
 * Sphere geometry for the dotted-globe graphics (pure; no DOM, tested).
 * Coordinates are [longitude, latitude] in degrees, EPSG:4326.
 */

const RAD = Math.PI / 180;

/** Evenly spread points on a sphere (Fibonacci lattice), as [lon, lat] degrees. */
export function fibonacciSphere(n: number): [number, number][] {
  const out: [number, number][] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - ((i + 0.5) / n) * 2; // sin(lat), strictly inside (-1, 1)
    const theta = golden * i;
    const lat = Math.asin(y) / RAD;
    const lon = ((((theta / RAD) % 360) + 540) % 360) - 180;
    out.push([lon, lat]);
  }
  return out;
}

export interface Projected {
  /** Unit-disk coordinates: x to the right, y downwards (screen orientation). */
  x: number;
  y: number;
  /** Cosine of the angular distance from the view centre; > 0 is the visible hemisphere. */
  z: number;
}

/** Orthographic projection centred on [lon0, lat0]. */
export function orthographic(lon: number, lat: number, lon0: number, lat0: number): Projected {
  const l = lon * RAD;
  const p = lat * RAD;
  const l0 = lon0 * RAD;
  const p0 = lat0 * RAD;
  const cosP = Math.cos(p);
  const dl = l - l0;
  return {
    x: cosP * Math.sin(dl),
    y: -(Math.cos(p0) * Math.sin(p) - Math.sin(p0) * cosP * Math.cos(dl)),
    z: Math.sin(p0) * Math.sin(p) + Math.cos(p0) * cosP * Math.cos(dl),
  };
}

/** Even-odd point-in-polygon over all rings (outer rings and holes alike). */
export function inRings(lon: number, lat: number, rings: number[][][]): boolean {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i] as [number, number];
      const [xj, yj] = ring[j] as [number, number];
      if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
        inside = !inside;
      }
    }
  }
  return inside;
}

/** Decode the flat [lon, lat, lon, lat, …] array stored in land-dots.json. */
export function decodeDots(flat: number[]): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) out.push([flat[i]!, flat[i + 1]!]);
  return out;
}
