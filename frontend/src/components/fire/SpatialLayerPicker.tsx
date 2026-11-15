import type { FireData } from '@/data/fireSchema';
import {
  SPATIAL_LAYER_IDS,
  SPATIAL_LAYERS,
  spatialValues,
  type SpatialLayerId,
} from '@/domain/fire/spatialLayers';

export function SpatialLayerPicker({
  data,
  layer,
  onLayer,
}: {
  data: FireData;
  layer: SpatialLayerId;
  onLayer: (layer: SpatialLayerId) => void;
}) {
  return (
    <fieldset>
      <legend>Spatial model estimates</legend>
      {SPATIAL_LAYER_IDS.map((id) => {
        const available = spatialValues(data, id).values.some((value) => value !== null);
        return (
          <label
            key={id}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minHeight: 44 }}
          >
            <input
              type="radio"
              name="spatial-layer"
              checked={layer === id}
              disabled={!available}
              onChange={() => onLayer(id)}
            />{' '}
            {SPATIAL_LAYERS[id].label}
            {!available && ' · No values supplied'}
          </label>
        );
      })}
    </fieldset>
  );
}
