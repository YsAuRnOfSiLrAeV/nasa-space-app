/**
 * Orbits of the missions the data comes from (`data/missions.ts`): dashed paths
 * fixed in space while the planet turns beneath them, each with a travelling
 * satellite and its name. Inclinations are real; node, radius, speed and phase
 * are display only.
 */
import { orthographic } from '@/components/graphics/sphere';
import { orbitPoint } from '@/components/graphics/globe';
import { MISSIONS, type MissionId } from '@/data/missions';
import { ORBITS_AT, ORBIT_DRAW, clamp01, cubicOut } from './choreography';
import type { PlanetFrame } from './frame';

const DISPLAY: Record<MissionId, { node: number; radius: number; period: number; phase: number }> =
  {
    gedi: { node: 28, radius: 1.24, period: 46, phase: 0.6 },
    landsat: { node: -52, radius: 1.46, period: 54, phase: 2.4 },
    nisar: { node: 64, radius: 1.68, period: 62, phase: 4.3 },
  };

export const ORBITS = MISSIONS.map((m) => ({
  ...m,
  ...DISPLAY[m.id],
  text: `${m.label.toUpperCase()} · ${m.inclination.toFixed(1)}°`,
}));

const STEPS = 200;

/**
 * Screen area a satellite's name must stay out of. Defaults fit the study-area
 * label (wide, mostly above the mark); a fire marker passes a smaller box.
 */
export interface Keepout {
  x: number;
  y: number;
  active: boolean;
  /** Half-width of the area, px. */
  halfWidth?: number;
  /** How far above and below the point the area reaches, px. */
  above?: number;
  below?: number;
}

/**
 * `subdued`: illustrative background geometry. Fainter paths, smaller satellites
 * and no names on the globe (the landing names them, with their real inclinations,
 * in its layer legend), so they never read as actual ground tracks.
 */
export function drawOrbits(f: PlanetFrame, keepout: Keepout, { subdued = false } = {}) {
  const { ctx, t, still, cx, cy, r, lat0, sway, colors } = f;
  const drawn = still ? 1 : cubicOut(clamp01((t - ORBITS_AT) / ORBIT_DRAW));
  if (drawn <= 0) return;

  const at = (o: (typeof ORBITS)[number], u: number) => {
    const [lon, lat] = orbitPoint(o.inclination, o.node, u);
    const q = orthographic(lon, lat, sway * 4, lat0);
    const hidden = q.z < 0 && Math.hypot(q.x, q.y) * o.radius < 1.01;
    return { x: cx + q.x * r * o.radius, y: cy + q.y * r * o.radius, z: q.z, hidden };
  };

  // Paths: the far side fainter, the part behind the planet hidden.
  ctx.strokeStyle = colors.silver;
  ctx.lineWidth = 1;
  ctx.setLineDash([1.5, 5]);
  for (const o of ORBITS) {
    const steps = Math.round(STEPS * drawn);
    for (const front of [false, true]) {
      ctx.globalAlpha = (front ? 0.5 : 0.2) * (subdued ? 0.45 : 1);
      ctx.beginPath();
      let pen = false;
      for (let j = 0; j <= steps; j++) {
        const q = at(o, o.phase + (j / STEPS) * Math.PI * 2);
        if (q.hidden || q.z >= 0 !== front) {
          pen = false;
          continue;
        }
        if (pen) ctx.lineTo(q.x, q.y);
        else ctx.moveTo(q.x, q.y);
        pen = true;
      }
      ctx.stroke();
    }
  }
  ctx.setLineDash([]);

  // Satellites: a small diamond travelling its orbit, with its name.
  const seen = still ? 1 : clamp01((t - ORBITS_AT - ORBIT_DRAW * 0.6) / 0.8);
  if (seen <= 0) return;
  ctx.font = `500 11px ${colors.mono}`;
  for (const o of ORBITS) {
    const q = at(o, o.phase + ((still ? 0 : t) / o.period) * Math.PI * 2);
    if (q.hidden) continue;
    const near = q.z >= 0 ? 1 : 0.45;
    ctx.fillStyle = colors.milky;
    const d = subdued ? 2.5 : 4;
    ctx.globalAlpha = seen * near * (subdued ? 0.6 : 1);
    ctx.beginPath();
    ctx.moveTo(q.x, q.y - d);
    ctx.lineTo(q.x + d, q.y);
    ctx.lineTo(q.x, q.y + d);
    ctx.lineTo(q.x - d, q.y);
    ctx.closePath();
    ctx.fill();
    if (subdued) continue;
    // No name while it would cross the study-area label.
    const k = keepout;
    if (
      k.active &&
      Math.abs(q.x - k.x) < (k.halfWidth ?? 330) &&
      q.y > k.y - (k.above ?? 120) &&
      q.y < k.y + (k.below ?? 45)
    )
      continue;
    // The name sits on the side towards the globe, so it never leaves the canvas.
    ctx.globalAlpha = 0.9 * seen * near;
    ctx.textAlign = q.x > cx ? 'right' : 'left';
    ctx.fillText(o.text, q.x + (q.x > cx ? -13 : 13), q.y - 11);
  }
  ctx.textAlign = 'left';
  ctx.globalAlpha = 1;
}
