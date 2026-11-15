/**
 * The Earth surface: Natural Earth 1:110m landmasses as flat dark plates with a
 * fine coastline. Real geography, no invented relief.
 */
import { traceVisible } from '@/components/graphics/globeCanvas';
import type { PlanetFrame } from './frame';
import type { LandRing } from '../../../domain/globe/landOutline';

export function drawLandmasses(f: PlanetFrame, rings: LandRing[] | null) {
  if (!rings) return;
  const { ctx, project, cx, cy, r, colors } = f;

  // Fill: points on the far side are pushed to the limb, so a continent that runs
  // over the edge stays one closed shape along the horizon.
  ctx.beginPath();
  for (const ring of rings) {
    const pts = ring.map(([lon, lat]) => project(lon, lat));
    if (!pts.some((p) => p.z > 0)) continue;
    pts.forEach((p, i) => {
      let { x, y } = p;
      if (p.z <= 0) {
        const d = Math.hypot(p.nx, p.ny) || 1;
        x = cx + (p.nx / d) * r;
        y = cy + (p.ny / d) * r;
      }
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    });
    ctx.closePath();
  }
  // Opaque, uniform geographic plates. No lighting or depth-based brightness.
  ctx.globalAlpha = 1;
  ctx.fillStyle = colors.land;
  ctx.fill('evenodd');

  // Coastline: visible arcs only.
  ctx.beginPath();
  for (const ring of rings) traceVisible(ctx, project, ring);
  ctx.strokeStyle = colors.coast;
  ctx.lineWidth = Math.max(0.85, r / 420);
  ctx.globalAlpha = 1;
  ctx.stroke();
  ctx.globalAlpha = 1;
}
