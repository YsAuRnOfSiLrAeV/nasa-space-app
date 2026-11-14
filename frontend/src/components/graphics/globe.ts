/**
 * Shared look of the app's globes (landing and locator): light direction, the
 * graticule, orbit paths and great-circle distance. Pure, no DOM, tested.
 * The canvas helpers that draw with these live in `globeCanvas.ts`.
 * Coordinates are [longitude, latitude] in degrees.
 */

const RAD = Math.PI / 180;

export type Vec3 = [number, number, number];

const normalise = (v: Vec3): Vec3 => {
  const n = Math.hypot(...v);
  return v.map((c) => c / n) as Vec3;
};

/** Light from the upper left, slightly towards the viewer (screen space, y down). */
export const LIGHT: Vec3 = normalise([-0.55, -0.5, 0.67]);

/** Lambert term for a unit-disk position (x, y right/down) and its depth z; 0 on the dark side. */
export function lambert(nx: number, ny: number, z: number): number {
  return Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + z * LIGHT[2]);
}

/**
 * Graticule as polylines: meridians every 30° (to ±84°), parallels every 20°
 * (to ±60°), sampled every `step` degrees.
 */
export function graticuleLines(step = 4): [number, number][][] {
  const lines: [number, number][][] = [];
  for (let lon = -180; lon < 180; lon += 30) {
    const line: [number, number][] = [];
    for (let lat = -84; lat <= 84; lat += step) line.push([lon, lat]);
    lines.push(line);
  }
  for (let lat = -60; lat <= 60; lat += 20) {
    const line: [number, number][] = [];
    for (let lon = -180; lon <= 180; lon += step) line.push([lon, lat]);
    lines.push(line);
  }
  return lines;
}

/** A parallel (circle of constant latitude), sampled every `step` degrees of longitude. */
export function parallel(lat: number, step = 3): [number, number][] {
  const line: [number, number][] = [];
  for (let lon = -180; lon <= 180; lon += step) line.push([lon, lat]);
  return line;
}

/**
 * Point on a circular orbit at angle `u` (radians from the ascending node),
 * for an orbit of inclination `incl` whose node lies at longitude `node`, as
 * [lon, lat] degrees on a unit sphere. Its latitude never exceeds the
 * inclination (or 180° minus it, for retrograde orbits).
 */
export function orbitPoint(incl: number, node: number, u: number): [number, number] {
  const i = incl * RAD;
  const n = node * RAD;
  const x = Math.cos(u) * Math.cos(n) - Math.sin(u) * Math.cos(i) * Math.sin(n);
  const y = Math.cos(u) * Math.sin(n) + Math.sin(u) * Math.cos(i) * Math.cos(n);
  const z = Math.sin(u) * Math.sin(i);
  return [Math.atan2(y, x) / RAD, Math.asin(Math.max(-1, Math.min(1, z))) / RAD];
}

/** Great-circle distance between two [lon, lat] points, in degrees. */
export function angularDistance(a: [number, number], b: [number, number]): number {
  const cos =
    Math.sin(a[1] * RAD) * Math.sin(b[1] * RAD) +
    Math.cos(a[1] * RAD) * Math.cos(b[1] * RAD) * Math.cos((a[0] - b[0]) * RAD);
  return Math.acos(Math.max(-1, Math.min(1, cos))) / RAD;
}
