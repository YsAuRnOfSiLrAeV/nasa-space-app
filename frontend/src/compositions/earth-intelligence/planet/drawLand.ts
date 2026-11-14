/**
 * Ocean dots and land on pins. Land stands off the surface on fine pins, so the
 * continents read as relief at the limb (uniform height, not elevation). Near
 * the study area the pins burn down and regrow with the loop.
 */
import { fibonacciSphere } from '@/components/graphics/sphere';
import { angularDistance, lambert } from '@/components/graphics/globe';
import { BURN_R, expoOut, pinHeat } from './choreography';
import type { PlanetFrame } from './frame';

const OCEAN = fibonacciSphere(3600);
/** Pin height, in globe radii. */
const PIN = 0.045;
/** Dots are batched by brightness: one path per bucket. */
const BUCKETS = 10;

type Buckets = number[][];
const buckets = (): Buckets => Array.from({ length: BUCKETS }, () => []);

interface Batches {
  ocean: Buckets; // x, y, r
  land: Buckets; // x, y, r
  pins: Buckets; // x0, y0, x1, y1
  hot: number[]; // x0, y0, x1, y1, r, heat
}

export function drawLand(
  f: PlanetFrame,
  dots: [number, number][] | null,
  {
    target,
    burn,
    ocean = true,
  }: {
    target: [number, number];
    burn: { active: boolean; c: number };
    /** The even dot field over the oceans (texture, not data). */
    ocean?: boolean;
  },
) {
  const b = collect(f, dots, target, burn, ocean);
  const { ctx, r, colors } = f;
  const scale = r / 300;

  ctx.strokeStyle = colors.mint;
  ctx.lineWidth = Math.max(0.5, 0.7 * scale);
  b.pins.forEach((seg, i) => {
    if (!seg.length) return;
    ctx.globalAlpha = Math.min(1, ((i + 0.5) / BUCKETS) * 0.55);
    ctx.beginPath();
    for (let j = 0; j < seg.length; j += 4) {
      ctx.moveTo(seg[j]!, seg[j + 1]!);
      ctx.lineTo(seg[j + 2]!, seg[j + 3]!);
    }
    ctx.stroke();
  });
  paintDots(ctx, b.ocean, colors.silver, 0.42, false);
  paintDots(ctx, b.land, colors.mint, 1.25, true);
  paintBurning(f, b.hot);
  ctx.globalAlpha = 1;
}

/** Projects, lights and buckets every visible dot, and splits off the burning pins. */
function collect(
  f: PlanetFrame,
  dots: [number, number][] | null,
  target: [number, number],
  burn: { active: boolean; c: number },
  ocean: boolean,
): Batches {
  const { project, appear, cx, cy, r } = f;
  const out: Batches = { ocean: buckets(), land: buckets(), pins: buckets(), hot: [] };
  const scale = r / 300;

  const add = (lon: number, lat: number, base: number, size: number, raised: boolean) => {
    const q = project(lon, lat);
    if (q.z <= 0.01) return;
    const a = appear(q.nx, q.ny, q.z);
    if (a <= 0) return;
    // Lambert light plus a rim highlight on the lit limb. Land keeps a little
    // light on the night side, so the continents stay readable.
    const L = lambert(q.nx, q.ny, q.z);
    const rim = Math.pow(1 - q.z, 2.2) * Math.pow(L + 0.15, 0.8);
    const l = Math.min(1, (raised ? 0.17 : 0.05) + 0.8 * Math.pow(L, 1.35) + 0.9 * rim);
    const bucket = Math.min(BUCKETS - 1, Math.floor(l * BUCKETS));
    const e = expoOut(a);
    const size_ = (base + size * q.z) * e;
    if (!raised) {
      out.ocean[bucket]!.push(q.x, q.y, size_);
      return;
    }
    const heat =
      burn.active && Math.abs(lat - target[1]) < BURN_R
        ? pinHeat(burn.c, angularDistance([lon, lat], target))
        : 0;
    // A burned pin drops almost to the ground and regrows as it recovers.
    const lift = 1 + PIN * e * (1 - 0.85 * heat);
    const hx = cx + q.nx * r * lift;
    const hy = cy + q.ny * r * lift;
    if (heat > 0.01) {
      out.hot.push(q.x, q.y, hx, hy, size_, heat);
      return;
    }
    out.land[bucket]!.push(hx, hy, size_);
    out.pins[bucket]!.push(q.x, q.y, hx, hy);
  };

  if (ocean) for (const [lon, lat] of OCEAN) add(lon, lat, 0.45 * scale, 0.75 * scale, false);
  if (dots) for (const [lon, lat] of dots) add(lon, lat, 0.6 * scale, 1.25 * scale, true);
  return out;
}

/** Ocean dots are about 1 px: squares look the same and cost far less than arcs. */
function paintDots(
  ctx: CanvasRenderingContext2D,
  set: Buckets,
  color: string,
  gain: number,
  round: boolean,
) {
  ctx.fillStyle = color;
  set.forEach((pts, i) => {
    if (!pts.length) return;
    ctx.globalAlpha = Math.min(1, ((i + 0.5) / BUCKETS) * gain);
    if (!round) {
      for (let j = 0; j < pts.length; j += 3) {
        const s = pts[j + 2]!;
        ctx.fillRect(pts[j]! - s, pts[j + 1]! - s, s * 2, s * 2);
      }
      return;
    }
    ctx.beginPath();
    for (let j = 0; j < pts.length; j += 3) {
      ctx.moveTo(pts[j]! + pts[j + 2]!, pts[j + 1]!);
      ctx.arc(pts[j]!, pts[j + 1]!, pts[j + 2]!, 0, Math.PI * 2);
    }
    ctx.fill();
  });
}

/** Burning and regrowing pins, cross-faded burgundy to mint one by one (a few dozen at most). */
function paintBurning({ ctx, colors }: PlanetFrame, hot: number[]) {
  for (let j = 0; j < hot.length; j += 6) {
    const heat = hot[j + 5]!;
    for (const [color, a] of [
      [colors.mint, 1 - heat],
      [colors.burn, heat],
    ] as const) {
      if (a <= 0.01) continue;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.globalAlpha = a * 0.6;
      ctx.beginPath();
      ctx.moveTo(hot[j]!, hot[j + 1]!);
      ctx.lineTo(hot[j + 2]!, hot[j + 3]!);
      ctx.stroke();
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.arc(hot[j + 2]!, hot[j + 3]!, hot[j + 4]! * (1 + 1.2 * heat), 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
