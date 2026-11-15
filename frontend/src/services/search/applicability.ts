import type { Polygon, MultiPolygon } from 'geojson';
import type { ApplicabilityZones } from '@/data/applicabilityZones';
import { coverage } from './coverage';

/** Geographic overlap neither checks exported datasets nor authorizes backend computation. */
export function evaluateApplicability(
  boundary: Polygon | MultiPolygon,
  zones: ApplicabilityZones | null,
) {
  if (!zones || !zones.features.length) return null;
  const share = (
    test: (properties: ApplicabilityZones['features'][number]['properties']) => boolean,
  ) =>
    coverage(boundary, {
      type: 'FeatureCollection',
      features: zones.features
        .filter((feature) => test(feature.properties))
        .map((feature) => ({
          type: 'Feature',
          geometry: feature.geometry,
          properties: { label: feature.properties.name_en, supported: true },
        })),
    })!;
  const has = (layer: ApplicabilityZones['features'][number]['properties']['layer']) =>
    zones.features.some((feature) => feature.properties.layer === layer);
  const model1 = has('model1_region')
    ? share((properties) => properties.layer === 'model1_region')
    : null;
  const verified =
    model1 === null
      ? null
      : share(
          (properties) => properties.layer === 'model1_region' && properties.status === 'verified',
        );
  return {
    model1Verified: verified,
    model1Extrapolated:
      model1 === null || verified === null ? null : Math.max(0, model1 - verified),
    model1Outside: model1 === null ? null : Math.max(0, 1 - model1),
    growthVerified: has('model2_growth')
      ? share((properties) => properties.layer === 'model2_growth')
      : null,
    scenarioVerified: has('model2_scenario')
      ? share((properties) => properties.layer === 'model2_scenario')
      : null,
  };
}
export type ApplicabilityCoverage = ReturnType<typeof evaluateApplicability>;
