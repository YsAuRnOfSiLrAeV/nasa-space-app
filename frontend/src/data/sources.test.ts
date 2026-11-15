import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Manifest, PointProperties } from './schema';
import { formatYearRange, gediYearRange, studySources } from './sources';

const ROOT = resolve(import.meta.dirname, '../..');
const manifest = JSON.parse(
  readFileSync(resolve(ROOT, 'public/data/manifest.json'), 'utf8'),
) as Manifest;

describe('data provenance', () => {
  const all = studySources(manifest, [2019, 2022]).flatMap((g) => g.sources);

  it('gives every dataset a use, a credit and its limitations', () => {
    expect(new Set(all.map((s) => s.id)).size).toBe(all.length);
    for (const s of all) {
      expect(s.use.trim(), s.id).not.toBe('');
      expect(s.credit.trim(), s.id).not.toBe('');
      expect(s.limits.trim(), s.id).not.toBe('');
    }
  });

  it('names every dataset the app shows or was built from', () => {
    const text = all.map((s) => `${s.name} ${s.credit}`).join(' ');
    for (const name of [
      'GEDI',
      'NISAR',
      'Sentinel-1',
      'Sentinel-2',
      'Natural Earth',
      'Blue Marble',
      'OpenStreetMap',
      'MCD64A1',
      'Hansen',
      'WorldCover',
      'Copernicus DEM',
    ]) {
      expect(text, name).toContain(name);
    }
  });

  it('describes 51.6° as GEDI orbital coverage, not a NISAR or study-area boundary', () => {
    const gedi = all.find((s) => s.id === 'gedi')!;
    expect(gedi.limits).toMatch(/51\.6°N and 51\.6°S/);
    expect(gedi.limits).toMatch(/ISS orbit/);
    expect(gedi.limits).toMatch(/not of NISAR or of this study area/);
  });

  it('states the real acquisition dates and the provisional status of NISAR', () => {
    const nisar = all.find((s) => s.id === 'nisar')!;
    for (const d of manifest.nisar_dates) expect(nisar.use).toContain(d);
    expect(nisar.limits).toMatch(/Provisional/);
  });
});

describe('GEDI year range', () => {
  const at = (gedi_year: number) => ({ gedi_year }) as PointProperties;

  it('spans the earliest and latest observation, in any order', () => {
    expect(gediYearRange([at(2021), at(2019), at(2022), at(2020)])).toEqual([2019, 2022]);
    expect(gediYearRange([])).toBeNull();
  });

  it('formats a span with an en dash and a single year alone', () => {
    expect(formatYearRange([2019, 2022])).toBe('2019–2022');
    expect(formatYearRange([2021, 2021])).toBe('2021');
  });
});
