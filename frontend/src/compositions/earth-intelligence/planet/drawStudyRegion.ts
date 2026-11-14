/**
 * Annotations grounded in data, drawn at their true coordinates:
 * - the GEDI coverage limit: the parallels at the ISS inclination (51.6°), north
 *   and south. GEDI samples only between them; the study region sits just inside.
 *   Labelled on the southern line, which runs far from the study region.
 * - the study region: the manifest bounding box traced on the sphere in mint (forest observation),
 *   with corner brackets and a leader to its extent in degrees. Its label sits on
 *   a knock-out plate, like a map label, so the lines beneath never cross the text.
 * Only the reveal timing is display. Positions are not.
 *
 * Draw the coverage limit first, then the study region over it.
 */
import { parallel } from '@/components/graphics/globe';
import { traceVisible } from '@/components/graphics/globeCanvas';
import { GEDI_LIMIT_LAT } from '@/data/missions';
import { LEADER_AT, MARK_AT, TYPE_AT, clamp01, cubicOut, expoOut } from './choreography';
import type { PlanetFrame, Projected } from './frame';
import { boxRing, extentLines, type BBox } from './region';

export type { BBox };

const NORTH_LIMIT = parallel(GEDI_LIMIT_LAT, 2);
const SOUTH_LIMIT = parallel(-GEDI_LIMIT_LAT, 2);
const LIMIT_TEXT = `GEDI COVERAGE LIMIT ±${GEDI_LIMIT_LAT}°`;
const REGION_TEXT = 'STUDY REGION';
/** When the coverage limit draws in: after the land has assembled. */
const LIMIT_AT = 1.2;

type Tracked = CanvasRenderingContext2D & { letterSpacing?: string };
function track(ctx: CanvasRenderingContext2D, px: number) {
  (ctx as Tracked).letterSpacing = `${px}px`;
}

/** Text with a thin halo in the ground colour, so it stays legible over the land dots. */
function haloText(f: PlanetFrame, text: string, x: number, y: number) {
  const { ctx, colors } = f;
  const fill = ctx.fillStyle;
  ctx.strokeStyle = colors.ground;
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

/** The GEDI coverage limit: dashed parallels at 51.6° north and south, labelled once. */
export function drawCoverageLimit(f: PlanetFrame) {
  const { ctx, t, still, project, colors, w, h } = f;
  const shown = still ? 1 : cubicOut(clamp01((t - LIMIT_AT) / 1.2));
  if (shown <= 0) return;

  ctx.strokeStyle = colors.signal;
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 4]);
  ctx.globalAlpha = 0.65 * shown;
  ctx.beginPath();
  traceVisible(ctx, project, NORTH_LIMIT);
  traceVisible(ctx, project, SOUTH_LIMIT);
  ctx.stroke();
  ctx.setLineDash([]);

  // Label under the lowest visible point of the southern line (beneath the planet).
  let low: Projected | null = null;
  for (const [lon, lat] of SOUTH_LIMIT) {
    const q = project(lon, lat);
    if (q.z <= 0.02) continue;
    if (!low || q.y > low.y) low = q;
  }
  if (!low) return;
  ctx.font = `600 10px ${colors.label}`;
  track(ctx, 1.3);
  const tw = ctx.measureText(LIMIT_TEXT).width;
  const x = Math.min(Math.max(8, low.x - tw / 2), w - tw - 8);
  const y = Math.min(low.y + 18, h - 6);
  ctx.fillStyle = colors.signal;
  ctx.globalAlpha = shown;
  ctx.textAlign = 'left';
  haloText(f, LIMIT_TEXT, x, y);
  track(ctx, 0);
  ctx.globalAlpha = 1;
}

/** The study region at its true extent, with a leader to its coordinates. */
export function drawStudyRegion(
  f: PlanetFrame,
  bbox: BBox,
  title = REGION_TEXT,
  { label = true }: { label?: boolean } = {},
) {
  const { ctx, t, still, project, colors } = f;
  const [west, south, east, north] = bbox;
  const centre = project((west + east) / 2, (south + north) / 2);
  const facing = clamp01((centre.z - 0.35) / 0.25);
  const markIn = (still ? 1 : expoOut(clamp01((t - MARK_AT) / 0.9))) * facing;
  if (markIn <= 0.01) return;

  // Outline and a faint fill, traced on the sphere.
  const pts = boxRing(bbox).map(([lon, lat]) => project(lon, lat));
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  ctx.fillStyle = colors.mint;
  ctx.globalAlpha = 0.24 * markIn;
  ctx.fill();
  ctx.strokeStyle = colors.mint;
  ctx.lineWidth = 1.25;
  ctx.globalAlpha = markIn;
  ctx.stroke();

  // Corner brackets around it (the region is only a few pixels across at globe scale).
  const box = bounds(pts);
  const pad = 7;
  const tick = 5;
  const L = box.x0 - pad;
  const R = box.x1 + pad;
  const T = box.y0 - pad;
  const B = box.y1 + pad;
  ctx.strokeStyle = colors.milky;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.85 * markIn;
  ctx.beginPath();
  for (const [x, y, dx, dy] of [
    [L, T, 1, 1],
    [R, T, -1, 1],
    [R, B, -1, -1],
    [L, B, 1, -1],
  ] as const) {
    ctx.moveTo(x, y + dy * tick);
    ctx.lineTo(x, y);
    ctx.lineTo(x + dx * tick, y);
  }
  ctx.stroke();

  // Narrow canvases (phones) keep the outline and brackets but not the label:
  // there is no room beside the fire markers; the legend names the region.
  if (label && f.w >= 520) drawRegionLabel(f, { L, R, T }, extentLines(bbox), facing, title);
}

function drawRegionLabel(
  f: PlanetFrame,
  { L, R, T }: { L: number; R: number; T: number },
  [lat, lon]: [string, string],
  facing: number,
  title: string,
) {
  const { ctx, t, still, colors, w, r } = f;
  ctx.font = `600 11px ${colors.label}`;
  track(ctx, 1.4);
  const titleW = ctx.measureText(title).width;
  track(ctx, 0);
  ctx.font = `400 11px ${colors.mono}`;
  const tw = Math.max(titleW, ctx.measureText(lat).width, ctx.measureText(lon).width);

  // Leader from the bracket, up and out to whichever side has room.
  const reach = Math.min(56, r * 0.3);
  const right = R + reach * 0.7 + tw + 16 <= w;
  const dir = right ? 1 : -1;
  const sx = right ? R : L;
  const elbow = { x: sx + dir * reach * 0.7, y: T - reach * 0.7 };
  const tx = Math.min(Math.max(8, right ? elbow.x + 4 : elbow.x - 4 - tw), w - tw - 8);

  // Knock-out plate behind the text block (title above the rule, extent below).
  const appear = still ? 1 : clamp01((t - TYPE_AT + 0.2) / 0.4);
  ctx.fillStyle = colors.ground;
  ctx.globalAlpha = 0.82 * facing * appear;
  ctx.fillRect(tx - 6, elbow.y - 22, tw + 12, 60);

  const seg1 = Math.hypot(elbow.x - sx, elbow.y - T);
  const seg2 = tw + 8;
  const lead = still ? 1 : cubicOut(clamp01((t - LEADER_AT) / 0.55));
  const drawn = (seg1 + seg2) * lead;
  ctx.strokeStyle = colors.milky;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.7 * facing;
  ctx.beginPath();
  ctx.moveTo(sx, T);
  if (drawn <= seg1) {
    const k = seg1 ? drawn / seg1 : 1;
    ctx.lineTo(sx + (elbow.x - sx) * k, T + (elbow.y - T) * k);
  } else {
    ctx.lineTo(elbow.x, elbow.y);
    ctx.lineTo(elbow.x + dir * Math.min(seg2, drawn - seg1), elbow.y);
  }
  if (lead > 0) ctx.stroke();

  const typed = still ? 1 : clamp01((t - TYPE_AT) / 0.6);
  const typed2 = still ? 1 : clamp01((t - TYPE_AT - 0.3) / 0.6);
  ctx.textAlign = 'left';
  ctx.fillStyle = colors.milky;
  ctx.globalAlpha = facing;
  ctx.font = `600 11px ${colors.label}`;
  track(ctx, 1.4);
  ctx.fillText(title.slice(0, Math.round(title.length * typed)), tx, elbow.y - 8);
  track(ctx, 0);
  ctx.font = `400 11px ${colors.mono}`;
  ctx.fillStyle = colors.silver;
  ctx.fillText(lat.slice(0, Math.round(lat.length * typed2)), tx, elbow.y + 16);
  ctx.fillText(lon.slice(0, Math.round(lon.length * typed2)), tx, elbow.y + 31);
  ctx.globalAlpha = 1;
}

function bounds(pts: Projected[]) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of pts) {
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x);
    y1 = Math.max(y1, p.y);
  }
  return { x0, y0, x1, y1 };
}
