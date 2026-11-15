import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PointCollectionSchema } from '@/data/schema';
import { computeStudyFigures } from './studyFigures';
import { rankSignals, signalRho } from './signalEvidence';
import type { Manifest } from '@/data/schema';

const ROOT = resolve(import.meta.dirname, '../../..');
const json = (p: string) => JSON.parse(readFileSync(resolve(ROOT, p), 'utf8')) as unknown;
const points = PointCollectionSchema.parse(json('public/data/points.geojson')).features.map(
  (f) => f.properties,
);

describe('signal evidence', () => {
  it('ranks the signals by ρ, strongest first (values as in SPACEAPPS_CONTEXT.md)', () => {
    const ranked = rankSignals(points).map(({ signal, rho }) => [
      signal.key,
      Math.round(rho * 100) / 100,
    ]);
    expect(ranked).toEqual([
      ['nisar_hv_db', 0.44],
      ['ndvi', 0.31],
      ['s1_vh_db', 0.17],
    ]);
  });

  it('gives the headline figure the same ρ as the ranking', () => {
    const manifest = json('public/data/manifest.json') as Manifest;
    const fig = computeStudyFigures(manifest, points).find((f) => f.id === 'nisarRho')!;
    expect(fig.value).toBe(signalRho(points, 'nisar_hv_db').toFixed(2));
  });
});
