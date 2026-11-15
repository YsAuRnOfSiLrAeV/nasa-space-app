import type { FireData } from '@/data/fireSchema';
import type { FireOverlayVisibility } from '@/domain/fire/overlays';
import {
  SPATIAL_LAYERS,
  SPATIAL_RAMP,
  spatialValues,
  type SpatialLayerId,
} from '@/domain/fire/spatialLayers';

export function SpatialLegend({
  data,
  layer,
  year,
  visible,
  overlays,
}: {
  data: FireData;
  layer: SpatialLayerId;
  year?: number | null;
  visible: boolean;
  overlays: FireOverlayVisibility;
}) {
  const range = spatialValues(data, layer, year);
  const spec = SPATIAL_LAYERS[range.layer];
  return (
    <div role="group" aria-label="Spatial layer legend">
      <strong>{visible ? spec.label : 'Recovery cells hidden'}</strong>
      {visible && (
        <>
          <p>
            {year != null
              ? `Modeled cell estimates · ${year}`
              : `Source summer · ${data.result.satellite_images.summer}`}{' '}
            · {spec.unit}
          </p>
          <div
            aria-hidden
            style={{
              height: 8,
              background: `linear-gradient(to right, ${SPATIAL_RAMP.join(',')})`,
            }}
          />
          <p>
            {range.min} — {Number(range.max.toFixed(2))}{' '}
            {range.layer === 'height' ? 'm' : range.layer === 'recovery' ? '%' : ''}
          </p>
          <p>Empty cells: not supplied. Display range; no reliability classification.</p>
          {range.layer === 'score' && <p>Relative ranking score, not a calibrated probability.</p>}
          {year != null && <p>Historical and future values are modeled estimates.</p>}
        </>
      )}
      <p>
        {overlays.perimeter && 'Fire perimeter · geographic boundary. '}
        {overlays.gedi && 'GEDI points · measured height. '}
        {overlays.optical && 'RGB · supplied georeferenced image.'}
      </p>
    </div>
  );
}
