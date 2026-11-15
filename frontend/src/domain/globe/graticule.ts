/** Pure helpers for a lat/lon graticule drawn from the live map bounds. */

const STEPS = [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30];

/** Smallest "nice" step giving at most `maxLines` lines across `span` degrees. */
export function graticuleStep(span: number, maxLines = 6): number {
  for (const s of STEPS) if (span / s <= maxLines) return s;
  return STEPS[STEPS.length - 1]!;
}

/** Multiples of `step` strictly inside (min, max), robust to float drift. */
export function graticuleTicks(min: number, max: number, step: number): number[] {
  const out: number[] = [];
  const start = Math.ceil(min / step - 1e-9);
  const end = Math.floor(max / step + 1e-9);
  for (let k = start; k <= end; k++) {
    const v = Number((k * step).toFixed(6));
    if (v > min && v < max) out.push(v);
  }
  return out;
}

function decimals(step: number): number {
  return step >= 1 ? 0 : step >= 0.1 ? (step === 0.25 ? 2 : 1) : 2;
}

export function formatLat(v: number, step = 0.001): string {
  return `${Math.abs(v).toFixed(decimals(step))}°${v >= 0 ? 'N' : 'S'}`;
}

export function formatLon(v: number, step = 0.001): string {
  return `${Math.abs(v).toFixed(decimals(step))}°${v >= 0 ? 'E' : 'W'}`;
}

/** A place as "51.40°N 93.90°W" (latitude first), from a [lon, lat] pair. */
export function formatLonLat([lon, lat]: readonly [number, number], step = 0.01): string {
  return `${formatLat(lat, step)} ${formatLon(lon, step)}`;
}

/** A bounding box [west, south, east, north] as "50.90°N–52.10°N · 94.80°W–92.60°W". */
export function formatExtent(
  [west, south, east, north]: readonly [number, number, number, number],
  step = 0.01,
): string {
  return `${formatLat(south, step)}–${formatLat(north, step)} · ${formatLon(west, step)}–${formatLon(east, step)}`;
}
