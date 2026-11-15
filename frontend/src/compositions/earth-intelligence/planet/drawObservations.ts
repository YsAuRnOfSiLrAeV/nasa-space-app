/**
 * Forest observations on the globe: every GEDI lidar footprint of the study at
 * its true position, as a fine mint point (mint = forest observation). At globe
 * scale they gather into the study region's patch; the panel and the region view
 * show them individually.
 */
import type { PlanetFrame } from './frame';

/** Screen box of a geographic extent on the globe, or null when it faces away. */
export interface ScreenBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * The observation window's extent (the Landsat scene crop) at its true position:
 * a small ink square, kept at least `min` px so it stays legible at globe scale.
 * Returns the drawn box, which the landing's leader lines run from.
 */
export function drawObservationMark(
  f: PlanetFrame,
  [west, south, east, north]: readonly [number, number, number, number],
  min = 7,
): ScreenBox | null {
  const { ctx, project, colors } = f;
  const corners = [
    project(west, south),
    project(east, south),
    project(east, north),
    project(west, north),
  ];
  if (corners.some((c) => c.z <= 0.1)) return null;
  const cx = corners.reduce((s, c) => s + c.x, 0) / 4;
  const cy = corners.reduce((s, c) => s + c.y, 0) / 4;
  const half = Math.max(
    min / 2,
    ...corners.map((c) => Math.max(Math.abs(c.x - cx), Math.abs(c.y - cy))),
  );
  const box = { x0: cx - half, y0: cy - half, x1: cx + half, y1: cy + half };
  ctx.globalAlpha = 1;
  ctx.fillStyle = colors.ground;
  ctx.fillRect(box.x0 - 1.5, box.y0 - 1.5, half * 2 + 3, half * 2 + 3);
  ctx.strokeStyle = colors.milky;
  ctx.lineWidth = 1;
  ctx.strokeRect(box.x0 + 0.5, box.y0 + 0.5, half * 2 - 1, half * 2 - 1);
  return box;
}

export function drawFootprints(f: PlanetFrame, points: readonly { lon: number; lat: number }[]) {
  const { ctx, project, colors, intro, r } = f;
  const size = Math.max(0.9, r / 280);
  ctx.fillStyle = colors.mint;
  for (const p of points) {
    const q = project(p.lon, p.lat);
    if (q.z <= 0.05) continue;
    ctx.globalAlpha = intro * Math.min(1, 0.35 + q.z);
    ctx.fillRect(q.x - size / 2, q.y - size / 2, size, size);
  }
  ctx.globalAlpha = 1;
}
