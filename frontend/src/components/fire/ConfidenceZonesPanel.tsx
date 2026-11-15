import { useEffect, useState } from 'react';
import { RESEARCH_HREF } from '@/app/route';
import type { StudyMapController } from '@/components/map/StudyMapController';
import { APPLICABILITY_LABELS, type ApplicabilityLayer } from '@/data/applicabilityZones';
import type { ApplicabilityResource } from '@/hooks/useApplicabilityZones';
import { ConfidenceZoneLegend } from './ConfidenceZoneLegend';

export function ConfidenceZonesPanel({
  mapView,
  resource,
}: {
  mapView: StudyMapController | null;
  resource: ApplicabilityResource;
}) {
  const [visible, setVisible] = useState(false);
  const [layer, setLayer] = useState<ApplicabilityLayer>('model1_region');
  const data = resource.state.status === 'ready' ? resource.state.data : null;
  const available = data?.features.some((feature) => feature.properties.layer === layer) ?? false;
  useEffect(() => {
    if (!mapView) return;
    if (visible && available && data) mapView.showConfidenceZones(data, layer);
    else mapView.clearConfidenceZones();
  }, [mapView, visible, available, data, layer]);
  useEffect(() => () => mapView?.clearConfidenceZones(), [mapView]);
  return (
    <section aria-label="Confidence zones and methodology">
      <a href={RESEARCH_HREF}>Methodology & limitations</a>
      <details>
        <summary>Confidence zones · geographic applicability</summary>
        {resource.state.status === 'loading' && (
          <p role="status">Loading supplied confidence zones…</p>
        )}
        {resource.state.status === 'error' && (
          <p role="alert">
            Confidence zones could not be loaded. Coverage remains unknown.{' '}
            <button type="button" onClick={resource.retry}>
              Retry zones
            </button>
          </p>
        )}
        <label>
          <input
            type="checkbox"
            checked={visible && available}
            disabled={!available || !mapView}
            onChange={(event) => setVisible(event.target.checked)}
          />{' '}
          Show confidence zones
        </label>
        <fieldset>
          <legend>Model classification</legend>
          {(Object.keys(APPLICABILITY_LABELS) as ApplicabilityLayer[]).map((id) => (
            <label
              key={id}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minHeight: 44 }}
            >
              <input
                type="radio"
                name="confidence-classification"
                checked={layer === id}
                disabled={!data?.features.some((feature) => feature.properties.layer === id)}
                onChange={() => setLayer(id)}
              />{' '}
              {APPLICABILITY_LABELS[id]}
            </label>
          ))}
        </fieldset>
        {!available && resource.state.status !== 'loading' && (
          <p>No supplied geometry for this classification; no coverage is assumed.</p>
        )}
        {visible && available && data && <ConfidenceZoneLegend data={data} layer={layer} />}
        <p>
          Geographic applicability is not a calibrated probability or a guarantee for an individual
          cell. Boundaries are approximate. Scenario and growth regions are separate; neither
          enables new analysis.
        </p>
        <p>
          GEDI points are measured canopy-height metrics. Cells and timelines are modeled estimates.
          Selected-fire reliability warnings remain beside the results.
        </p>
      </details>
    </section>
  );
}
