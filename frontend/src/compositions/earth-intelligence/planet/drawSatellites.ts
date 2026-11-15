/**
 * The three missions the study's data comes from, flying their orbits around
 * the landing globe, each drawn as a recognisable spacecraft silhouette:
 *   NISAR    hexagonal bus, one solar wing, and the 12 m mesh radar reflector
 *            on its boom (the instrument that sees trunks and branches).
 *   Landsat  box bus with instruments and a single solar array.
 *   GEDI     flies on the International Space Station: the ISS truss, its
 *            modules and solar arrays.
 * Inclinations are real (`data/missions.ts`). Orbit radius, node, speed and
 * phase are display only, and the landing says so in its figure index.
 * Flat fills and hairlines; no gradients or glow.
 */
import { orthographic } from '@/domain/globe/sphere';
import { orbitPoint } from '@/components/graphics/globe';
import { MISSIONS, type MissionId } from '@/data/missions';
import type { PlanetFrame } from './frame';

/** Display-only orbit geometry; radii in globe radii, all inside the canvas square. */
const DISPLAY: Record<MissionId, { node: number; radius: number; period: number; phase: number }> =
  {
    // Phases put every craft in front of and beside the globe at the start (and in
    // the reduced-motion pose): NISAR right, Landsat lower left, the ISS below.
    gedi: { node: 28, radius: 1.14, period: 44, phase: 5.15 },
    landsat: { node: -52, radius: 1.22, period: 56, phase: 5.85 },
    nisar: { node: 64, radius: 1.3, period: 64, phase: 6.02 },
  };

export const SATELLITE_ORBITS = MISSIONS.map((m) => ({
  ...m,
  ...DISPLAY[m.id],
  text: `${m.label.toUpperCase()} · ${m.inclination.toFixed(1)}°`,
}));

type Orbit = (typeof SATELLITE_ORBITS)[number];
const STEPS = 180;

export function drawSatellites(f: PlanetFrame) {
  const { ctx, t, still, cx, cy, r, lat0, sway, colors } = f;

  const at = (o: Orbit, u: number) => {
    const [lon, lat] = orbitPoint(o.inclination, o.node, u);
    const q = orthographic(lon, lat, sway * 4, lat0);
    // Behind the planet: on the far side and inside its silhouette.
    const hidden = q.z < 0 && Math.hypot(q.x, q.y) * o.radius < 1.01;
    return { x: cx + q.x * r * o.radius, y: cy + q.y * r * o.radius, z: q.z, hidden };
  };

  // Paths: fine dashed hairlines, fainter on the far side, hidden behind the planet.
  ctx.save();
  ctx.strokeStyle = colors.silver;
  ctx.lineWidth = 0.9;
  ctx.setLineDash([2, 4]);
  for (const o of SATELLITE_ORBITS) {
    for (const front of [false, true]) {
      ctx.globalAlpha = front ? 0.6 : 0.22;
      ctx.beginPath();
      let pen = false;
      for (let j = 0; j <= STEPS; j++) {
        const q = at(o, (j / STEPS) * Math.PI * 2);
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
  ctx.restore();

  // Spacecraft, far ones first so near ones overlap them.
  const base = Math.max(0.95, Math.min(1.7, r / 175));
  const craft = SATELLITE_ORBITS.map((o) => {
    const u = o.phase + ((still ? 0 : t) / o.period) * Math.PI * 2;
    const q = at(o, u);
    const next = at(o, u + 0.02);
    return { o, q, heading: Math.atan2(next.y - q.y, next.x - q.x) };
  }).sort((a, b) => a.q.z - b.q.z);

  for (const { o, q, heading } of craft) {
    if (q.hidden) continue;
    const near = q.z >= 0;
    const s = base * (near ? 1 : 0.75);
    ctx.save();
    ctx.globalAlpha = near ? 1 : 0.55;
    ctx.translate(q.x, q.y);
    ctx.rotate(heading);
    ctx.scale(s, s);
    if (o.id === 'nisar') nisar(ctx, colors);
    else if (o.id === 'landsat') landsat(ctx, colors);
    else iss(ctx, colors);
    ctx.restore();

    if (!near) continue;
    // Name outward from the globe (away from the study annotations), on a
    // short leader, kept inside the canvas, with a ground-colour halo.
    const ux = q.x >= cx ? 1 : -1;
    const uy = q.y >= cy ? 1 : -1;
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = colors.silver;
    ctx.lineWidth = 0.75;
    ctx.beginPath();
    ctx.moveTo(q.x + ux * 18 * s, q.y + uy * 14 * s);
    ctx.lineTo(q.x + ux * 26 * s, q.y + uy * 22 * s);
    ctx.stroke();
    ctx.font = `400 10px ${colors.mono}`;
    const tw = ctx.measureText(o.text).width;
    const left = ux > 0 ? q.x + ux * 28 * s : q.x + ux * 28 * s - tw;
    const x = Math.min(Math.max(6, left), f.w - tw - 6);
    const y = q.y + uy * 22 * s + (uy > 0 ? 11 : -3);
    ctx.textAlign = 'left';
    ctx.strokeStyle = colors.ground;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.strokeText(o.text, x, y);
    ctx.fillStyle = colors.milky;
    ctx.fillText(o.text, x, y);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

type Colors = PlanetFrame['colors'];

/** A solar panel: flat cell-blue plate with cell lines and an ink edge. */
function panel(
  ctx: CanvasRenderingContext2D,
  c: Colors,
  x: number,
  y: number,
  w: number,
  h: number,
  cells = 4,
) {
  ctx.fillStyle = c.panel;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = c.ground;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  const long = h > w;
  for (let i = 1; i < cells; i++) {
    if (long) {
      ctx.moveTo(x, y + (h * i) / cells);
      ctx.lineTo(x + w, y + (h * i) / cells);
    } else {
      ctx.moveTo(x + (w * i) / cells, y);
      ctx.lineTo(x + (w * i) / cells, y + h);
    }
  }
  ctx.stroke();
  ctx.strokeStyle = c.milky;
  ctx.lineWidth = 0.6;
  ctx.strokeRect(x, y, w, h);
}

/** NISAR: bus, one solar wing, boom and the large mesh reflector. Travels along +x. */
function nisar(ctx: CanvasRenderingContext2D, c: Colors) {
  // Boom from the bus up to the reflector feed.
  ctx.strokeStyle = c.milky;
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(1, -4);
  ctx.lineTo(4, -14);
  ctx.lineTo(7, -17);
  ctx.stroke();
  // Reflector: a dish seen obliquely, with radial ribs.
  const dx = 7;
  const dy = -22;
  ctx.fillStyle = c.ground;
  ctx.beginPath();
  ctx.ellipse(dx, dy, 13, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    ctx.moveTo(dx, dy);
    ctx.lineTo(dx + Math.cos(a) * 13, dy + Math.sin(a) * 5.5);
  }
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(dx, dy, 13, 5.5, 0, 0, Math.PI * 2);
  ctx.stroke();
  // Bus: hexagonal body.
  ctx.fillStyle = c.milky;
  ctx.beginPath();
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
    const x = Math.cos(a) * 4.5;
    const y = Math.sin(a) * 4.5;
    if (k) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  // One solar wing on the opposite side.
  ctx.strokeStyle = c.milky;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(0, 4.5);
  ctx.lineTo(0, 7);
  ctx.stroke();
  panel(ctx, c, -4.5, 7, 9, 20, 5);
}

/** Landsat 8/9: box bus, instrument blocks, one solar array on a short arm. */
function landsat(ctx: CanvasRenderingContext2D, c: Colors) {
  ctx.strokeStyle = c.milky;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(-3, -4);
  ctx.lineTo(-3, -8);
  ctx.stroke();
  panel(ctx, c, -11, -24, 16, 16, 4);
  ctx.fillStyle = c.milky;
  ctx.fillRect(-7, -4, 13, 8);
  // Instruments (OLI and TIRS) at the front end.
  ctx.fillRect(6.5, -3, 4, 3);
  ctx.fillRect(6.5, 0.8, 3, 2.4);
  ctx.strokeStyle = c.ground;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(-1, -4);
  ctx.lineTo(-1, 4);
  ctx.stroke();
}

/** The ISS (GEDI's platform): truss across the direction of travel, modules along it, arrays at both ends. */
function iss(ctx: CanvasRenderingContext2D, c: Colors) {
  for (const y of [-24, -17, 13, 20]) {
    panel(ctx, c, -12, y, 10, 4, 4);
    panel(ctx, c, 2, y, 10, 4, 4);
  }
  ctx.fillStyle = c.milky;
  // Main truss.
  ctx.fillRect(-1, -25, 2, 50);
  // Pressurised modules along the direction of travel.
  ctx.fillRect(-10, -2, 20, 4);
  ctx.fillRect(-4, -3, 5, 6);
  // Radiators.
  ctx.fillRect(-5, 6, 4, 2);
  ctx.fillRect(1, -8, 4, 2);
}
