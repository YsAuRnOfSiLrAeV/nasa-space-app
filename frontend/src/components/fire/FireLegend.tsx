import type { FireOverlayVisibility } from '@/components/map/fireLayers';
import { GRID_LAYERS, type GridLayerId, type LayerCoverage } from '../../domain/fire/fireGrid';
import styles from './FireGrid.module.css';

/**
 * The legend for what is drawn right now: the active categorical layer, then only
 * the overlays that are both supplied and switched on.
 */
export function FireLegend({
  layer,
  coverage,
  overlays,
}: {
  layer: GridLayerId;
  coverage: LayerCoverage;
  /** Overlays that are drawn (available and on). */
  overlays: FireOverlayVisibility;
}) {
  const spec = GRID_LAYERS[layer];
  return (
    <div className={styles.legend} aria-label={`${spec.label} legend`} role="group">
      <div>
        <h3>{spec.label}</h3>
        <p>{spec.description}</p>
      </div>
      <ul>
        {spec.categories.map((name, i) => (
          <li key={name}>
            <span
              aria-hidden
              className={styles.swatch}
              style={{ background: `var(${spec.tokens[i]})` }}
            />
            {name}
          </li>
        ))}
        {coverage.outside > 0 && (
          <li>
            <span
              aria-hidden
              className={styles.swatch}
              style={{ background: 'var(--grid-outside)' }}
            />
            Outside the model’s geographic domain (no estimate)
          </li>
        )}
        <li>
          <span aria-hidden className={`${styles.swatch} ${styles.empty}`} />
          No value supplied (left empty, not interpolated)
        </li>
      </ul>
      <ul aria-label="Map outlines and points">
        {overlays.perimeter && (
          <li style={{ color: 'var(--amber)' }}>
            <span aria-hidden className={styles.lineSwatch} />
            <span className="text-foreground">Fire perimeter</span>
          </li>
        )}
        {overlays.zone && (
          <li style={{ color: 'var(--grid-zone)' }}>
            <span aria-hidden className={styles.lineSwatch} />
            <span className="text-foreground">Neighbouring forest (reference zone)</span>
          </li>
        )}
        {overlays.gedi && (
          <li>
            <span aria-hidden className={styles.dotSwatch} />
            GEDI lidar footprint (measurement)
          </li>
        )}
        <li style={{ color: 'var(--map-label)' }}>
          <span aria-hidden className={styles.dashSwatch} />
          <span className="text-foreground">Grid extent</span>
        </li>
      </ul>
      <p>
        {coverage.valued.toLocaleString()} of {coverage.total.toLocaleString()} cells have a{' '}
        {spec.label.toLowerCase()} value
        {coverage.outside > 0
          ? `; ${coverage.outside.toLocaleString()} lie outside the domain`
          : ''}
        .
        {layer === 'probability' &&
          ' This is the model’s relative score for each cell, not a calibrated probability, and not the geographic domain shown in grey. Band thresholds are provisional.'}
      </p>
    </div>
  );
}
