import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ApplicabilityZonesSchema } from '@/data/applicabilityZones';
import { ConfidenceZonesPanel } from './ConfidenceZonesPanel';
import { ConfidenceZoneLegend } from './ConfidenceZoneLegend';
import { MethodologyGuide } from '@/pages/research/MethodologyGuide';
import { MapNavigationContext } from '@/app/mapNavigation';
import { RESEARCH_HREF, mapHref } from '@/app/route';

const zones = ApplicabilityZonesSchema.parse(
  JSON.parse(
    readFileSync(
      resolve(import.meta.dirname, '../../../public/data/bundle-v2/confidence_zones.geojson'),
      'utf8',
    ),
  ),
);
const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');

describe('confidence classifications and scientific context', () => {
  it('preserves the eight provider features and distinguishes Model 1 validation from model-2 capabilities', () => {
    expect(zones.features).toHaveLength(8);
    expect(
      zones.features.filter(
        (feature) =>
          feature.properties.layer === 'model1_region' && feature.properties.status === 'verified',
      ),
    ).toHaveLength(3);
    expect(
      zones.features.filter((feature) => feature.properties.status === 'extrapolated'),
    ).toHaveLength(3);
    const model1 = text(
      renderToStaticMarkup(<ConfidenceZoneLegend data={zones} layer="model1_region" />),
    );
    for (const label of [
      'Solid outline',
      'Dashed outline',
      'not directly validated',
      'Humid continental',
      'Mediterranean',
      'Tropical savanna',
      'ranking grade: moderate',
      'not a confidence probability',
    ])
      expect(model1).toContain(label);
    const growth = text(
      renderToStaticMarkup(<ConfidenceZoneLegend data={zones} layer="model2_growth" />),
    );
    expect(growth).toContain('Growth forecast validated (Canada)');
    expect(growth).not.toContain('Fire-severity scenario (Ukraine)');
    expect(growth).not.toContain('ranking grade');
    const scenario = text(
      renderToStaticMarkup(<ConfidenceZoneLegend data={zones} layer="model2_scenario" />),
    );
    expect(scenario).toContain('Fire-severity scenario (Ukraine)');
    expect(scenario).not.toContain('Growth forecast validated (Canada)');
  });
  it('provides a methodology link, independent model choices and a deliberate visibility switch', () => {
    const html = renderToStaticMarkup(
      <ConfidenceZonesPanel
        mapView={null}
        resource={{ state: { status: 'ready', data: zones }, retry: () => {} }}
      />,
    );
    expect(html).toContain(`href="${RESEARCH_HREF}"`);
    expect(html).toContain('Methodology &amp; limitations');
    expect(html).toContain('Show confidence zones');
    expect([...html.matchAll(/type="radio"/g)]).toHaveLength(3);
    expect(html).toContain('Geographic applicability is not a calibrated probability');
    expect(html).toContain('Cells and timelines are modeled estimates');
    expect(html).toContain('neither enables new analysis');
  });
  it('keeps missing and failed zones unavailable rather than inventing supported geometry', () => {
    const absent = text(
      renderToStaticMarkup(
        <ConfidenceZonesPanel
          mapView={null}
          resource={{ state: { status: 'absent' }, retry: () => {} }}
        />,
      ),
    );
    expect(absent).toContain('No supplied geometry');
    expect(absent).toContain('no coverage is assumed');
    const failed = text(
      renderToStaticMarkup(
        <ConfidenceZonesPanel
          mapView={null}
          resource={{ state: { status: 'error', message: 'Failed' }, retry: () => {} }}
        />,
      ),
    );
    expect(failed).toContain('Coverage remains unknown');
    expect(failed).toContain('Retry zones');
  });
  it('rejects invalid map style metadata before passing it to MapLibre', () => {
    for (const invalid of [{ color: 'javascript:test' }, { opacity: 2 }]) {
      const first = zones.features.find((feature) => feature.properties.layer === 'model1_region')!;
      expect(
        ApplicabilityZonesSchema.safeParse({
          ...zones,
          features: [{ ...first, properties: { ...first.properties, ...invalid } }],
        }).success,
      ).toBe(false);
    }
  });
  it('explains sensor roles, observation/model distinctions and calibration limits with primary references', () => {
    const html = renderToStaticMarkup(<MethodologyGuide />);
    const copy = text(html);
    for (const label of [
      'NISAR',
      'Sentinel-1',
      'NDVI',
      'GEDI',
      'not a calibrated probability',
      'Missing cells remain empty',
      'held-out study results',
      'temporal mismatch',
      'provisional NISAR calibration',
      'seen during training',
      'Unsupported forecasts stay unavailable',
      'Absent NISAR',
    ]) {
      expect(copy.toLowerCase()).toContain(label.toLowerCase());
    }
    for (const domain of [
      'www.nasa.gov',
      'sentiwiki.copernicus.eu',
      'science.nasa.gov',
      'gedi.umd.edu',
    ])
      expect(html).toContain(`https://${domain}/`);
  });
  it('returns to the exact selected Explorer route from Methodology', () => {
    const state = {
      mode: 'find-your-fire' as const,
      presentation: 'fire' as const,
      fireId: 'ukraine_2020_3009_5131',
      country: 'ukraine',
    };
    const html = renderToStaticMarkup(
      <MapNavigationContext.Provider value={state}>
        <MethodologyGuide />
      </MapNavigationContext.Provider>,
    );
    expect(html).toContain(`href="${mapHref(state).replace(/&/g, '&amp;')}"`);
    expect(html).toContain('Return to Explorer');
  });
});
