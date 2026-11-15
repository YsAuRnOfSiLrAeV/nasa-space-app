import {
  APPLICABILITY_LABELS,
  type ApplicabilityLayer,
  type ApplicabilityZones,
} from '@/data/applicabilityZones';

export function ConfidenceZoneLegend({
  data,
  layer,
}: {
  data: ApplicabilityZones;
  layer: ApplicabilityLayer;
}) {
  const regions = [
    ...new Map(
      data.features
        .filter((feature) => feature.properties.layer === layer)
        .map((feature) => [feature.properties.name_en, feature.properties]),
    ).values(),
  ];
  return (
    <div role="group" aria-label="Confidence zone legend">
      <strong>{APPLICABILITY_LABELS[layer]}</strong>
      <p>
        Solid outline and stronger fill: provider-verified region.{' '}
        {layer === 'model1_region'
          ? 'Dashed outline and lighter fill: extrapolated region, not directly validated.'
          : 'No extrapolated regions are supplied for this classification.'}
      </p>
      <ul>
        {regions.map((properties) => (
          <li key={properties.name_en}>
            {properties.name_en}
            {properties.layer === 'model1_region'
              ? ` · provider ranking grade: ${properties.reliability}`
              : ''}
          </li>
        ))}
      </ul>
      <p>
        Colors identify regions; fill opacity is a visual treatment, not a confidence probability.
      </p>
    </div>
  );
}
