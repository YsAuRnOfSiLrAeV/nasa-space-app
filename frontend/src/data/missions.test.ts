import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Manifest } from './schema';
import { GEDI_LIMIT_LAT, MISSIONS, describeOrbits, mission } from './missions';
import { studySources } from './sources';

const manifest = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '../../public/data/manifest.json'), 'utf8'),
) as Manifest;

describe('missions', () => {
  it('derives the GEDI coverage limit from the ISS inclination', () => {
    expect(GEDI_LIMIT_LAT).toBe(51.6);
    expect(GEDI_LIMIT_LAT).toBe(mission('gedi').inclination);
  });

  it('agrees with the GEDI limitation stated in the sources panel', () => {
    const gedi = studySources(manifest, [2019, 2022])
      .flatMap((g) => g.sources)
      .find((s) => s.id === 'gedi')!;
    expect(gedi.limits).toContain(`${GEDI_LIMIT_LAT}°N and ${GEDI_LIMIT_LAT}°S`);
  });

  it('has one entry per mission with a plausible inclination', () => {
    expect(new Set(MISSIONS.map((m) => m.id)).size).toBe(MISSIONS.length);
    for (const m of MISSIONS) {
      expect(m.inclination).toBeGreaterThan(0);
      expect(m.inclination).toBeLessThan(180);
    }
  });

  it('describes every orbit, with its inclination, in one sentence', () => {
    expect(describeOrbits()).toBe(
      'GEDI on the International Space Station (51.6° inclination), Landsat 8 and 9 (98.2°) and NISAR (98.4°)',
    );
  });
});
