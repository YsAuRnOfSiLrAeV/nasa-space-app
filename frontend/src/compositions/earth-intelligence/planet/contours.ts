/**
 * Decorative cartographic ground for the landing: contour linework traced from a
 * seeded noise field. It is paper texture, not terrain: it has no coordinates,
 * no elevations and no labels, and the figure index says so.
 *
 * The field is a gentle fBm surface plus a slope toward the lower edge and the
 * sides, so contours stay sparse behind the figure and gather into "relief"
 * near the bottom and edges. Density, not shading, carries the effect (no gradients).
 */

/** Deterministic hash → [0, 1). */
function hash(ix: number, iy: number, seed: number): number {
  let h = (ix * 374761393 + iy * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const fade = (t: number) => t * t * (3 - 2 * t);

function valueNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = fade(x - ix);
  const fy = fade(y - iy);
  const a = hash(ix, iy, seed);
  const b = hash(ix + 1, iy, seed);
  const c = hash(ix, iy + 1, seed);
  const d = hash(ix + 1, iy + 1, seed);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

function fbm(x: number, y: number, seed: number): number {
  let sum = 0;
  let amp = 0.5;
  let f = 1;
  for (let o = 0; o < 4; o++) {
    sum += amp * valueNoise(x * f, y * f, seed + o * 17);
    amp *= 0.5;
    f *= 2.03;
  }
  return sum;
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Field height at (u, v), both 0…1 across the surface. */
export function groundHeight(u: number, v: number, aspect: number, seed = 7): number {
  const base = fbm(u * 3.2 * aspect, v * 3.2, seed);
  // Relief: a rising slope toward the bottom edge and, more gently, the sides.
  const bottom = smoothstep(0.55, 1, v) * 2.4;
  const side = (smoothstep(0.72, 1, u) + smoothstep(0.72, 1, 1 - u)) * 0.9;
  // Extra roughness where the slope is, so the lower contours read as terrain.
  const rough = (bottom + side) * 0.35 * fbm(u * 9 * aspect, v * 9, seed + 101);
  return base + bottom + side + rough;
}

export interface ContourSegments {
  /** Flat [x0, y0, x1, y1, …] in pixels. */
  minor: number[];
  /** Every fifth level, drawn slightly brighter. */
  index: number[];
}

/**
 * Marching squares over `groundHeight`, sampled every `step` pixels, at a fixed
 * level interval. Returns unjoined segments; drawing them as one path each is
 * fast and visually identical.
 */
export function traceContours(w: number, h: number, step = 7, interval = 0.075): ContourSegments {
  const cols = Math.ceil(w / step) + 1;
  const rows = Math.ceil(h / step) + 1;
  const aspect = w / Math.max(1, h);
  const field = new Float32Array(cols * rows);
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++)
      field[j * cols + i] = groundHeight((i * step) / w, (j * step) / h, aspect);

  const minor: number[] = [];
  const index: number[] = [];
  const lerp = (a: number, b: number, level: number) => (level - a) / (b - a || 1e-9);

  for (let j = 0; j < rows - 1; j++) {
    for (let i = 0; i < cols - 1; i++) {
      const a = field[j * cols + i]!; // top-left
      const b = field[j * cols + i + 1]!; // top-right
      const c = field[(j + 1) * cols + i + 1]!; // bottom-right
      const d = field[(j + 1) * cols + i]!; // bottom-left
      const lo = Math.min(a, b, c, d);
      const hi = Math.max(a, b, c, d);
      const x = i * step;
      const y = j * step;
      for (let k = Math.ceil(lo / interval); k * interval <= hi; k++) {
        const level = k * interval;
        // Edge crossings: top, right, bottom, left.
        const pts: number[] = [];
        if (a < level !== b < level) pts.push(x + lerp(a, b, level) * step, y);
        if (b < level !== c < level) pts.push(x + step, y + lerp(b, c, level) * step);
        if (d < level !== c < level) pts.push(x + lerp(d, c, level) * step, y + step);
        if (a < level !== d < level) pts.push(x, y + lerp(a, d, level) * step);
        const out = k % 5 === 0 ? index : minor;
        if (pts.length >= 4) out.push(pts[0]!, pts[1]!, pts[2]!, pts[3]!);
        if (pts.length === 8) out.push(pts[4]!, pts[5]!, pts[6]!, pts[7]!);
      }
    }
  }
  return { minor, index };
}
