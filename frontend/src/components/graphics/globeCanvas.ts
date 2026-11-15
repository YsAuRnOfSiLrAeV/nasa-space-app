/**
 * Canvas helpers shared by the app's globes. Geometry comes from `globe.ts`;
 * these only draw it.
 */
import { withAlpha } from './useCanvasRenderer';

/** Projects [lon, lat] to canvas pixels plus depth (z > 0 is the visible hemisphere). */
export type Project = (lon: number, lat: number) => { x: number; y: number; z: number };

/**
 * Adds a [lon, lat] polyline to the current path, lifting the pen wherever it
 * passes behind the globe (z at or below `minZ`). The caller strokes.
 */
export function traceVisible(
  ctx: CanvasRenderingContext2D,
  project: Project,
  line: [number, number][],
  minZ = 0.02,
): void {
  let pen = false;
  for (const [lon, lat] of line) {
    const p = project(lon, lat);
    if (p.z <= minZ) {
      pen = false;
      continue;
    }
    if (pen) ctx.lineTo(p.x, p.y);
    else ctx.moveTo(p.x, p.y);
    pen = true;
  }
}

/**
 * The globe's edge: one flat hairline (no fade: project rule, no gradients).
 * Of `alphas` ([lit, middle, night], kept for callers) only the first sets the opacity.
 */
export function drawLimb(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color: string,
  {
    alphas = [0.75, 0.1, 0.04],
    width = 1.2,
  }: { alphas?: [number, number, number]; width?: number } = {},
): void {
  ctx.strokeStyle = withAlpha(color, alphas[0] * 0.7);
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 0.5, 0, Math.PI * 2);
  ctx.stroke();
}
