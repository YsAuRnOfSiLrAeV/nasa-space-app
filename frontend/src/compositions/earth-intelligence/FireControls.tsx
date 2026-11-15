import type { FireOverlayVisibility } from '@/components/map/fireLayers';
import {
  GRID_LAYER_IDS,
  GRID_LAYERS,
  type GridLayerId,
  type layerCoverage,
  type overlayAvailability,
} from '@/domain/fire/fireGrid';
import type { OpticalStatus } from '@/hooks/useOpticalImage';
import styles from './MapShell.module.css';

export type LayerCoverage = Record<GridLayerId, ReturnType<typeof layerCoverage>>;
type Availability = ReturnType<typeof overlayAvailability>;

/** Which grid layer the map shows; a layer without values says so. */
export function GridLayerPicker({
  layer,
  coverage,
  onLayer,
}: {
  layer: GridLayerId;
  coverage: LayerCoverage;
  onLayer: (layer: GridLayerId) => void;
}) {
  return (
    <fieldset className={styles.controls}>
      <legend>Grid layer</legend>
      {GRID_LAYER_IDS.map((id) => (
        <label key={id}>
          <input
            type="radio"
            name="fire-grid-layer"
            value={id}
            checked={layer === id}
            onChange={() => onLayer(id)}
          />
          <span>
            {GRID_LAYERS[id].label}
            {coverage[id].valued === 0 && <small> · no values supplied</small>}
          </span>
        </label>
      ))}
    </fieldset>
  );
}

const OVERLAYS: { id: keyof FireOverlayVisibility; label: string; missing: string }[] = [
  { id: 'perimeter', label: 'Fire perimeter', missing: 'No perimeter supplied' },
  { id: 'zone', label: 'Neighbouring-forest zone', missing: 'No reference cells supplied' },
  { id: 'gedi', label: 'GEDI lidar footprints', missing: 'No GEDI footprints supplied' },
  { id: 'optical', label: 'Optical image (export)', missing: 'No optical image supplied' },
];

/** Why the optical overlay cannot be switched on, or null when it can. */
function opticalReason(optical: OpticalStatus): string | null {
  if (optical === 'ready') return null;
  if (optical === 'loading') return 'Loading optical image…';
  if (optical === 'missing') return 'Optical image named in the export could not be loaded';
  return 'No optical image supplied';
}

/** Overlays that can be drawn over the grid: an overlay without data is disabled, with the reason. */
export function OverlayToggles({
  overlays,
  available,
  optical,
  onChange,
}: {
  overlays: FireOverlayVisibility;
  available: Availability;
  optical: OpticalStatus;
  onChange: (overlays: FireOverlayVisibility) => void;
}) {
  return (
    <fieldset className={styles.controls}>
      <legend>Overlays</legend>
      {OVERLAYS.map(({ id, label, missing }) => {
        const reason = id === 'optical' ? opticalReason(optical) : available[id] ? null : missing;
        return (
          <label key={id} data-disabled={reason !== null || undefined}>
            <input
              type="checkbox"
              checked={reason === null && overlays[id]}
              disabled={reason !== null}
              onChange={(event) => onChange({ ...overlays, [id]: event.target.checked })}
            />
            <span>
              {label}
              {reason !== null && <small> · {reason}</small>}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
