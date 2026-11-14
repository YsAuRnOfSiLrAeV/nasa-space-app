/** Solid geographic shapes with crisp, unlit reference linework. */
import { graticuleLines } from '@/components/graphics/globe';
import { traceVisible } from '@/components/graphics/globeCanvas';
import type { PlanetFrame } from './frame';

const GRATICULE = graticuleLines(4);

/**
 * Opaque ocean plate. This name is retained for the existing renderer;
 * no atmosphere, light falloff or translucent lighting overlay is drawn.
 */
export function drawAtmosphere({ ctx, cx, cy, r, colors }: PlanetFrame) {
  ctx.globalAlpha = 1;
  ctx.fillStyle = colors.ocean;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

/** The latitude/longitude grid, turning with the surface. */
export function drawGraticule({ ctx, project, colors }: PlanetFrame) {
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 0.75;
  ctx.globalAlpha = 1;
  ctx.beginPath();
  for (const line of GRATICULE) traceVisible(ctx, project, line);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/** One precise limb with north-up orientation and projection reference ticks. */
export function drawLimb({ ctx, cx, cy, r, colors }: PlanetFrame) {
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = colors.coast;
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  for (let angle = 0; angle < 360; angle += 90) {
    const a = (angle * Math.PI) / 180;
    ctx.moveTo(cx + Math.cos(a) * (r + 5), cy + Math.sin(a) * (r + 5));
    ctx.lineTo(cx + Math.cos(a) * (r + 12), cy + Math.sin(a) * (r + 12));
  }
  ctx.stroke();
  ctx.font = `400 10px ${colors.mono}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = colors.coast;
  ctx.fillText('N', cx, cy - r - 20);
  ctx.restore();
  ctx.globalAlpha = 1;
}
