/**
 * Small pure helpers for the landing's instrument readouts. Every value comes
 * from the loaded study files; nothing here invents or rounds away data.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Acquisition dates ("YYYY-MM-DD") as a compact readout: "13 · 18 · 20 Jul 2026"
 * when they share a month, otherwise each date in full. Unparseable entries are
 * shown as given, never dropped. Empty input gives null (missing stays missing).
 */
export function formatAcquisitionDates(dates: readonly string[]): string | null {
  if (!dates.length) return null;
  const sorted = [...dates].sort();
  const parsed: { y: string; mo: number; day: number }[] = [];
  for (const d of sorted) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
    const mo = Number(m?.[2]);
    if (!m || mo < 1 || mo > 12) return sorted.join(' · ');
    parsed.push({ y: m[1]!, mo, day: Number(m[3]) });
  }
  const first = parsed[0]!;
  if (parsed.every((p) => p.y === first.y && p.mo === first.mo)) {
    return `${parsed.map((p) => p.day).join(' · ')} ${MONTHS[first.mo - 1]} ${first.y}`;
  }
  return parsed.map((p) => `${p.day} ${MONTHS[p.mo - 1]} ${p.y}`).join(' · ');
}

/**
 * Plot geometry for a bounding box [west, south, east, north]: an
 * equirectangular frame with longitude scaled by cos(mid-latitude), so the
 * region keeps its true shape. Returns the frame height for a given width and
 * a projector into that frame.
 */
export function regionPlot(bbox: readonly [number, number, number, number], width: number) {
  const [w, s, e, n] = bbox;
  const k = Math.cos((((s + n) / 2) * Math.PI) / 180);
  const height = (width * (n - s)) / ((e - w) * k);
  return {
    height,
    at: (lon: number, lat: number) => ({
      x: ((lon - w) / (e - w)) * width,
      y: ((n - lat) / (n - s)) * height,
    }),
  };
}
