import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BundleIndexSchema, bundleIndexEntry } from '@/data/bundleV2';
import { FireSearch } from '@/compositions/earth-intelligence/FireSearch';
import { GeographicCoverage } from './GeographicCoverage';

const root = resolve(import.meta.dirname, '../../../public/data/bundle-v2');
const index = BundleIndexSchema.parse(
  JSON.parse(readFileSync(resolve(root, 'index.json'), 'utf8')),
);
const entries = index.fires.map((entry) => bundleIndexEntry(entry, index.summer));

describe('real Find Your Fire interface', () => {
  it('lists all 80 exports, retains drawing, and disables unsupported computation', () => {
    const html = renderToStaticMarkup(
      <FireSearch
        catalog={{ state: { status: 'ready', data: entries }, retry: () => {} }}
        mapView={null}
        state={{ mode: 'find-your-fire', presentation: 'fire', fireId: 'bc_2003_490' }}
        onResult={async () => {}}
      />,
    );
    for (const entry of entries) expect(html).toContain(entry.id);
    expect(html).toContain('All countries');
    expect(html).toContain('Draw Polygon');
    expect(html).toContain('Open available exported data');
    expect(html).toContain('Spatial data available');
    expect(html).toContain('Perimeter and summary only');
    expect(html).toMatch(/<button[^>]*disabled[^>]*>New analysis unavailable<\/button>/);
    expect(html).toContain('Coverage cannot be evaluated');
    expect(html).not.toContain('/runs');
  });
  it('presents unknown coverage and model-specific percentages without implying a new prediction', () => {
    const unknown = renderToStaticMarkup(<GeographicCoverage value={null} />);
    expect(unknown).toContain('Coverage cannot be evaluated');
    expect(unknown).not.toContain('100.0%');
    const html = renderToStaticMarkup(
      <GeographicCoverage
        value={{
          model1Verified: 0.5,
          model1Extrapolated: 0.25,
          model1Outside: 0.25,
          growthVerified: 0,
          scenarioVerified: null,
        }}
      />,
    );
    for (const text of [
      '50.0%',
      '25.0%',
      '0.0%',
      'Not supplied',
      'not directly validated',
      'not a probability',
      'New analysis is unavailable',
    ])
      expect(html).toContain(text);
  });
  it('explains an unknown fire identifier without offering a fabricated result', () => {
    const html = renderToStaticMarkup(
      <FireSearch
        catalog={{ state: { status: 'ready', data: entries }, retry: () => {} }}
        mapView={null}
        state={{ mode: 'find-your-fire', presentation: 'fire', fireId: 'unknown-test-id' }}
        onResult={async () => {}}
      />,
    );
    expect(html).toContain('No exported dataset exists for this identifier');
    expect(html).not.toContain('Open available exported data');
  });
});
