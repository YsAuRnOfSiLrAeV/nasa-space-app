/**
 * Synthetic terrain for the illustrative forest block: a deterministic height
 * field (seeded value-noise fBm, a broad ridge and a meandering stream valley).
 * Pure and DOM-free. It is NOT geographic terrain; a later version may replace
 * it with supplied elevation (see `recoveryAdapter.ts`).
 */

export interface HeightField {
  /** Side length of the square block, scene units. */
  size: number;
  /** Samples per side (grid of res × res). */
  res: number;
  /** Row-major heights, z rows then x columns. */
  heights: Float32Array;
  min: number;
  max: number;
  /** Bilinear height at scene (x, z); x and z in [-size/2, size/2]. */
  sample: (x: number, z: number) => number;
  /** Distance (scene units) from the stream's centre line at (x, z). */
  streamDistance: (x: number, z: number) => number;
}

export interface HeightFieldOptions {
  size?: number;
  res?: number;
  seed?: number;
  /** Peak relief, scene units. */
  relief?: number;
  /**
   * 0..1: turns the stream and the ridge into another landscape. Omitted, the original
   * block is produced exactly.
   */
  variant?: number;
}

/** Deterministic hash → [0, 1). */
export function hash2(ix: number, iy: number, seed: number): number {
  let h = (ix * 374761393 + iy * 668265263 + seed * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const fade = (t: number) => t * t * (3 - 2 * t);

export function valueNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = fade(x - ix);
  const fy = fade(y - iy);
  const a = hash2(ix, iy, seed);
  const b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed);
  const d = hash2(ix + 1, iy + 1, seed);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

export function fbm(x: number, y: number, seed: number, octaves = 5): number {
  let sum = 0;
  let amp = 0.5;
  let f = 1;
  for (let o = 0; o < octaves; o++) {
    sum += amp * valueNoise(x * f, y * f, seed + o * 31);
    amp *= 0.5;
    f *= 2.02;
  }
  return sum;
}

/** Seeded PRNG (mulberry32): the same seed always scatters the same forest. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createHeightField({
  size = 120,
  res = 161,
  seed = 11,
  relief = 15,
  variant,
}: HeightFieldOptions = {}): HeightField {
  const half = size / 2;
  // The stream: a gentle S-curve crossing the block diagonally.
  const bend = variant === undefined ? 0 : variant - 0.5;
  const phase = 0.7 + bend * 5;
  const tilt = 0.25 + bend * 0.4;
  const ridgeSlope = 0.6 + bend * 1.6;
  const streamX = (z: number) =>
    -size * 0.12 + Math.sin((z / size) * Math.PI * 1.6 + phase) * size * 0.14 + z * tilt;
  const streamDistance = (x: number, z: number) => Math.abs(x - streamX(z)) * 0.92;

  const raw = (x: number, z: number) => {
    const u = x / size;
    const v = z / size;
    const base = fbm(u * 3.1 + 7, v * 3.1 + 3, seed);
    // A broad ridge rising toward the far corner.
    const ridge = 0.55 * Math.max(0, 0.5 + 0.9 * (v - u * ridgeSlope));
    const fine = 0.12 * fbm(u * 14, v * 14, seed + 97, 3);
    // Valley carved along the stream, widening with depth.
    const d = streamDistance(x, z);
    const valley = 0.42 * Math.exp(-(d * d) / (2 * (size * 0.07) ** 2));
    return base + ridge + fine - valley;
  };

  const heights = new Float32Array(res * res);
  let min = Infinity;
  let max = -Infinity;
  for (let j = 0; j < res; j++) {
    for (let i = 0; i < res; i++) {
      const x = -half + (i / (res - 1)) * size;
      const z = -half + (j / (res - 1)) * size;
      const h = raw(x, z);
      heights[j * res + i] = h;
      if (h < min) min = h;
      if (h > max) max = h;
    }
  }
  // Normalise to [0, relief].
  const span = max - min || 1;
  for (let k = 0; k < heights.length; k++) heights[k] = ((heights[k]! - min) / span) * relief;

  const sample = (x: number, z: number) => {
    const fx = Math.min(res - 1, Math.max(0, ((x + half) / size) * (res - 1)));
    const fz = Math.min(res - 1, Math.max(0, ((z + half) / size) * (res - 1)));
    const i = Math.min(res - 2, Math.floor(fx));
    const j = Math.min(res - 2, Math.floor(fz));
    const tx = fx - i;
    const tz = fz - j;
    const a = heights[j * res + i]!;
    const b = heights[j * res + i + 1]!;
    const c = heights[(j + 1) * res + i]!;
    const d = heights[(j + 1) * res + i + 1]!;
    return a + (b - a) * tx + (c - a) * tz + (a - b - c + d) * tx * tz;
  };

  return { size, res, heights, min: 0, max: relief, sample, streamDistance };
}

/** Terrain slope (rise over run) at (x, z), by central differences. */
export function slopeAt(field: HeightField, x: number, z: number, e = 0.75): number {
  const dx = (field.sample(x + e, z) - field.sample(x - e, z)) / (2 * e);
  const dz = (field.sample(x, z + e) - field.sample(x, z - e)) / (2 * e);
  return Math.hypot(dx, dz);
}

/**
 * Contour segments of the field at a fixed interval (marching squares).
 * Flat [x0, y0, z0, x1, y1, z1, …]; every `indexEvery`-th level goes to `index`.
 */
export function contourSegments(
  field: HeightField,
  interval: number,
  indexEvery = 5,
): { minor: number[]; index: number[] } {
  const { res, size, heights } = field;
  const half = size / 2;
  const step = size / (res - 1);
  const minor: number[] = [];
  const index: number[] = [];
  const lerp = (a: number, b: number, l: number) => (l - a) / (b - a || 1e-9);
  for (let j = 0; j < res - 1; j++) {
    for (let i = 0; i < res - 1; i++) {
      const a = heights[j * res + i]!;
      const b = heights[j * res + i + 1]!;
      const c = heights[(j + 1) * res + i + 1]!;
      const d = heights[(j + 1) * res + i]!;
      const lo = Math.min(a, b, c, d);
      const hi = Math.max(a, b, c, d);
      const x = -half + i * step;
      const z = -half + j * step;
      for (let k = Math.max(1, Math.ceil(lo / interval)); k * interval <= hi; k++) {
        const l = k * interval;
        const pts: number[] = [];
        if (a < l !== b < l) pts.push(x + lerp(a, b, l) * step, z);
        if (b < l !== c < l) pts.push(x + step, z + lerp(b, c, l) * step);
        if (d < l !== c < l) pts.push(x + lerp(d, c, l) * step, z + step);
        if (a < l !== d < l) pts.push(x, z + lerp(a, d, l) * step);
        const out = k % indexEvery === 0 ? index : minor;
        for (let p = 0; p + 3 < pts.length; p += 4)
          out.push(pts[p]!, l, pts[p + 1]!, pts[p + 2]!, l, pts[p + 3]!);
      }
    }
  }
  return { minor, index };
}
