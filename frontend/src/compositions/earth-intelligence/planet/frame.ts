/**
 * One frame of the landing globe: canvas, time, camera, projection and theme
 * colours, computed once per paint and handed to every layer.
 */
import { orthographic } from '@/components/graphics/sphere';
import { lambert } from '@/components/graphics/globe';
import { cssVar, type CanvasFrame } from '@/components/graphics/useCanvasRenderer';
import { ASSEMBLE_SPREAD, DOT_GROW, SETTLED, clamp01, quintOut } from './choreography';

export interface Projected {
  x: number;
  y: number;
  /** Unit-disk position (x right, y down) and depth (> 0 faces the viewer). */
  nx: number;
  ny: number;
  z: number;
}

export interface PlanetColors {
  ocean: string;
  land: string;
  coast: string;
  grid: string;
  mint: string;
  silver: string;
  milky: string;
  ground: string;
  forest: string;
  burn: string;
  burnText: string;
  /** Instrument state (coverage limits). */
  signal: string;
  /** The study region. */
  amber: string;
  mono: string;
  /** Solar-panel cells on the spacecraft silhouettes. */
  panel: string;
  /** Family for small uppercase labels. */
  label: string;
}

export interface PlanetFrame {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  /** Seconds since start; `SETTLED` when motion is reduced. */
  t: number;
  still: boolean;
  cx: number;
  cy: number;
  /** Fixed globe radius in pixels. */
  r: number;
  /** Camera latitude, and the pointer's horizontal sway (orbits follow it, not the turn). */
  lat0: number;
  sway: number;
  project: (lon: number, lat: number) => Projected;
  /** 0…1 as the dot at (nx, ny, z) assembles; the lit side arrives first. */
  appear: (nx: number, ny: number, z: number) => number;
  /** 0…1 reveal for observation annotations; geographic plates remain opaque. */
  intro: number;
  colors: PlanetColors;
}

/** Pointer position over the stage, -1…1 on each axis. */
export interface Pointer {
  x: number;
  y: number;
}

/** Eases `smooth` towards the pointer (critically damped, no overshoot). */
export function followPointer(smooth: Pointer, pointer: Pointer | null, still: boolean): Pointer {
  const p = pointer ?? { x: 0, y: 0 };
  const k = still ? 1 : 0.045;
  smooth.x += (p.x - smooth.x) * k;
  smooth.y += (p.y - smooth.y) * k;
  return smooth;
}

export function readColors(el: Element): PlanetColors {
  return {
    ocean: cssVar(el, '--cartography-ocean', '#171b20'),
    land: cssVar(el, '--cartography-land', '#5b6067'),
    coast: cssVar(el, '--cartography-coast', '#c3c6c8'),
    grid: cssVar(el, '--cartography-grid', '#373b41'),
    mint: cssVar(el, '--mint', '#9fd5c8'),
    silver: cssVar(el, '--silver', '#c8cdd2'),
    milky: cssVar(el, '--foreground', '#f1ede6'),
    ground: cssVar(el, '--background', '#0b0b0e'),
    forest: cssVar(el, '--forest', '#3aa994'),
    burn: cssVar(el, '--burn', '#b53e5d'),
    burnText: cssVar(el, '--burn-text', '#d37487'),
    signal: cssVar(el, '--signal', '#60b4ec'),
    amber: cssVar(el, '--amber', '#f7b755'),
    mono: cssVar(el, '--font-coord', 'monospace'),
    panel: cssVar(el, '--cartography-panel', '#22344a'),
    label: cssVar(el, '--font-label', 'sans-serif'),
  };
}

/** Degrees and seconds of the camera drift around the target. */
const DRIFT_DEG = 7;
const DRIFT_PERIOD = 90;

/**
 * Camera: faces the target, drifting slowly a few degrees either side, plus an
 * pointer response. The geographic shape is present at full size immediately.
 * Reduced motion shows the
 * target facing the viewer.
 */
export function planetFrame(
  { ctx, w, h, t: clock, still }: CanvasFrame,
  { target, sway, colors }: { target: [number, number]; sway: Pointer; colors: PlanetColors },
): PlanetFrame {
  const t = still ? SETTLED : clock;
  const cx = w / 2;
  const cy = h / 2;
  // The globe keeps the target (Canada) in view: a slow drift of a few degrees
  // instead of a full turn, so the place being studied never rotates away.
  const drift = still ? 0 : DRIFT_DEG * Math.sin((t / DRIFT_PERIOD) * Math.PI * 2);
  const lon0 = target[0] + 4 + drift + sway.x * 6;
  const lat0 = 30 - sway.y * 5;
  // The Earth carries the composition; the margin holds projection annotations.
  const r = Math.min(w, h) * 0.37;
  return {
    ctx,
    w,
    h,
    t,
    still,
    cx,
    cy,
    r,
    lat0,
    sway: sway.x,
    project: (lon, lat) => {
      const q = orthographic(lon, lat, lon0, lat0);
      return { x: cx + q.x * r, y: cy + q.y * r, nx: q.x, ny: q.y, z: q.z };
    },
    appear: (nx, ny, z) =>
      still ? 1 : clamp01((t - 0.15 - (1 - lambert(nx, ny, z)) * ASSEMBLE_SPREAD) / DOT_GROW),
    intro: still ? 1 : quintOut(clamp01(t / 1.8)),
    colors,
  };
}
