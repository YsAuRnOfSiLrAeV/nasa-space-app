/** Region codes in fire identifiers, in the reader's words. */
const REGIONS: Record<string, string> = {
  bc: 'British Columbia',
  alberta: 'Alberta',
  manitoba: 'Manitoba',
  ontario: 'Ontario',
  quebec: 'Quebec',
  greece: 'Greece',
  spain: 'Spain',
  turkey: 'Turkey',
  ukraine: 'Ukraine',
  zambia: 'Zambia',
  tanzania: 'Tanzania',
};

/**
 * A readable name for a fire id.
 * Canada: `bc_2003_488` becomes "British Columbia · 2003 · #488" (the number keeps fires of
 * the same place and year apart). Elsewhere the id carries the fire's position in hundredths
 * of a degree: `ukraine_2020_3009_5131` becomes "Ukraine · 2020 · 30.09°E 51.31°N".
 * Unknown id shapes stay as they are.
 */
export function fireLabel(id: string): string {
  const place = /^([a-z]+)_(\d{4})_(-?\d+)_(-?\d+)$/.exec(id);
  if (place) {
    const [, region, year, x, y] = place;
    const lon = Number(x) / 100;
    const lat = Number(y) / 100;
    const where = `${Math.abs(lon).toFixed(2)}°${lon < 0 ? 'W' : 'E'} ${Math.abs(lat).toFixed(2)}°${lat < 0 ? 'S' : 'N'}`;
    return `${REGIONS[region!] ?? region} · ${year} · ${where}`;
  }
  const canada = /^([a-z]+)_(\d{4})_(\d+)$/.exec(id);
  if (!canada) return id;
  const [, region, year, serial] = canada;
  return `${REGIONS[region!] ?? region} · ${year} · #${serial}`;
}

const CANADA = new Set(['bc', 'alberta', 'manitoba', 'ontario', 'quebec']);

/** The country a fire id belongs to, for grouping a list ("Canada" covers the provinces). */
export function fireCountry(id: string): string {
  const region = /^([a-z]+)_/.exec(id)?.[1];
  if (!region) return 'Other';
  return CANADA.has(region) ? 'Canada' : (REGIONS[region] ?? region);
}
