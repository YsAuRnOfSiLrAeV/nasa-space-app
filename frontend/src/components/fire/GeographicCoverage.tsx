import type { ApplicabilityCoverage } from '@/services/search/applicability';

export function GeographicCoverage({
  value,
  error,
}: {
  value: ApplicabilityCoverage;
  error?: string;
}) {
  const pct = (share: number | null) =>
    share === null ? 'Not supplied · coverage unknown' : `${(share * 100).toFixed(1)}%`;
  return (
    <section aria-label="Geographic model applicability">
      <h4>Geographic model applicability</h4>
      {error ? (
        <p role="alert">{error}</p>
      ) : value ? (
        <dl>
          <dt>Model 1 · verified geographic coverage</dt>
          <dd>{pct(value.model1Verified)}</dd>
          <dt>Model 1 · extrapolated only, not directly validated</dt>
          <dd>{pct(value.model1Extrapolated)}</dd>
          <dt>Outside supplied model-1 regions · no applicability claim</dt>
          <dd>{pct(value.model1Outside)}</dd>
          <dt>Growth forecast · verified geographic coverage</dt>
          <dd>{pct(value.growthVerified)}</dd>
          <dt>Fire-severity scenario · geographic coverage only</dt>
          <dd>{pct(value.scenarioVerified)}</dd>
        </dl>
      ) : (
        <p>
          Coverage cannot be evaluated: a boundary and supplied applicability zones are required.
        </p>
      )}
      <p>
        Coverage is not a probability, a dataset-availability check or permission to run a new
        prediction. New analysis is unavailable. Source: confidence_zones.geojson; verified and
        extrapolated follow the provider's documented meanings. Provider boundaries are approximate;
        the percentages describe geometric overlap.
      </p>
    </section>
  );
}
