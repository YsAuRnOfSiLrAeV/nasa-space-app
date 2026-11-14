/**
 * The study area: a ring that opens, a reticle, a slow pulse, and a leader to a
 * label that types in (name, coordinates, then the burn loop's state in words).
 * It fades as the turn carries it towards the limb and returns each revolution.
 */
import { formatLonLat } from '@/components/map/graticule';
import { LEADER_AT, MARK_AT, TYPE_AT, clamp01, cubicOut, expoOut } from './choreography';
import type { PlanetFrame, Projected } from './frame';

const RING = 9;
const TITLE = 'STUDY AREA · NW ONTARIO';

export interface StudyMark {
  /** Where the mark is on screen. */
  at: Projected;
  /** 0…1: how squarely it faces the viewer (0 near the limb or behind). */
  facing: number;
}

/** Where the study area is this frame, and whether it faces the viewer. */
export function locateStudyMark(f: PlanetFrame, target: [number, number]): StudyMark {
  const at = f.project(target[0], target[1]);
  return { at, facing: clamp01((at.z - 0.45) / 0.25) };
}

export function drawStudyMark(
  f: PlanetFrame,
  mark: StudyMark,
  { target, heat, fireYears }: { target: [number, number]; heat: number; fireYears: string | null },
) {
  const { t, still } = f;
  const markIn = (still ? 1 : expoOut(clamp01((t - MARK_AT) / 0.9))) * mark.facing;
  if (markIn <= 0.01) return;
  drawReticle(f, mark, markIn, heat);
  drawLabel(f, mark, { coords: formatLonLat(target), heat, fireYears });
  f.ctx.globalAlpha = 1;
}

/** Ring with a core that is burgundy while burned and forest green as it recovers. */
function drawReticle(
  { ctx, t, still, colors }: PlanetFrame,
  { at: m, facing }: StudyMark,
  markIn: number,
  heat: number,
) {
  ctx.strokeStyle = colors.milky;
  ctx.lineWidth = 1.4;
  ctx.globalAlpha = markIn;
  ctx.beginPath();
  ctx.arc(m.x, m.y, RING * (0.4 + 0.6 * markIn), 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = colors.forest;
  ctx.beginPath();
  ctx.arc(m.x, m.y, 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colors.burn;
  ctx.globalAlpha = markIn * heat;
  ctx.fill();

  // Corners around the mark.
  const rc = 17;
  const tick = 5;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.8 * markIn;
  ctx.beginPath();
  for (const [dx, dy] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ] as const) {
    ctx.moveTo(m.x + dx * rc, m.y + dy * (rc - tick));
    ctx.lineTo(m.x + dx * rc, m.y + dy * rc);
    ctx.lineTo(m.x + dx * (rc - tick), m.y + dy * rc);
  }
  ctx.stroke();

  if (!still && t > MARK_AT + 0.6) {
    const pulse = ((t - MARK_AT - 0.6) % 2.8) / 2.8;
    ctx.globalAlpha = 0.7 * (1 - cubicOut(pulse)) * facing;
    ctx.strokeStyle = heat > 0.5 ? colors.burnText : colors.mint;
    ctx.beginPath();
    ctx.arc(m.x, m.y, RING + cubicOut(pulse) * 26, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/** Leader to whichever side has room, then the label typing in. */
function drawLabel(
  { ctx, w, r, t, still, colors }: PlanetFrame,
  { at: m, facing }: StudyMark,
  { coords, heat, fireYears }: { coords: string; heat: number; fireYears: string | null },
) {
  ctx.strokeStyle = colors.milky;
  ctx.fillStyle = colors.milky;
  ctx.font = `500 12px ${colors.mono}`;
  const tw = ctx.measureText(TITLE).width;
  const reach = Math.min(64, r * 0.3);
  const dir = m.x + reach + tw + 16 <= w ? 1 : -1;
  const lead = still ? 1 : cubicOut(clamp01((t - LEADER_AT) / 0.55));
  const sx = m.x + dir * RING * 0.72;
  const sy = m.y - RING * 0.72;
  const elbow = { x: m.x + dir * reach * 0.75, y: m.y - reach * 0.75 };
  const seg1 = Math.hypot(elbow.x - sx, elbow.y - sy);
  const seg2 = tw + 8;
  const drawn = (seg1 + seg2) * lead;
  ctx.globalAlpha = 0.75 * facing;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  if (drawn <= seg1) {
    const k = seg1 ? drawn / seg1 : 1;
    ctx.lineTo(sx + (elbow.x - sx) * k, sy + (elbow.y - sy) * k);
  } else {
    ctx.lineTo(elbow.x, elbow.y);
    ctx.lineTo(elbow.x + dir * Math.min(seg2, drawn - seg1), elbow.y);
  }
  if (lead > 0) ctx.stroke();

  const typed = still ? 1 : clamp01((t - TYPE_AT) / 0.8);
  const typed2 = still ? 1 : clamp01((t - TYPE_AT - 0.45) / 0.7);
  const tx = dir > 0 ? elbow.x + 4 : elbow.x - 4 - tw;
  ctx.textAlign = 'left';
  ctx.globalAlpha = facing;
  ctx.fillText(TITLE.slice(0, Math.round(TITLE.length * typed)), tx, elbow.y - 8);
  ctx.globalAlpha = 0.75 * facing;
  ctx.font = `400 11px ${colors.mono}`;
  ctx.fillText(coords.slice(0, Math.round(coords.length * typed2)), tx, elbow.y + 17);
  if (typed2 < 1) return;
  // The loop's state in words: burned (with the fire years), then recovering.
  const burned = heat > 0.5;
  ctx.fillStyle = burned ? colors.burnText : colors.mint;
  ctx.globalAlpha = facing * (burned ? heat : 1 - heat);
  ctx.fillText(
    burned ? `BURNED${fireYears ? ` · ${fireYears}` : ''}` : 'RECOVERING',
    tx,
    elbow.y + 35,
  );
}
