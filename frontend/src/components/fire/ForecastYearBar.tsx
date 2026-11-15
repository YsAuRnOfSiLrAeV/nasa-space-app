import { estimateFor, type GrowthCurve } from '../../domain/fire/growthForecast';
import { formatShare } from '../../domain/fire/fireSummary';
import styles from './FireResults.module.css';

/**
 * Forecast year slider along the bottom of the map. Rendered only for a valid
 * forecast. It changes the fire-level forecast readout and chart indicator only:
 * the grid keeps showing the observation summer, and the camera is untouched.
 */
export function ForecastYearBar({
  curve,
  year,
  onYear,
}: {
  curve: GrowthCurve;
  year: number;
  onYear: (year: number) => void;
}) {
  const estimate = estimateFor(curve, year);
  const kind = estimate.year === curve.summer ? 'forecast at the observation summer' : 'forecast';
  const valueText = `${estimate.year}, ${kind}: expected whole-fire recovery ${formatShare(estimate.value)}${
    estimate.reliable ? '' : ', extrapolation outside the validated ages'
  }. Map grid unchanged, summer ${curve.summer}.`;
  return (
    <div
      className={styles.yearBar}
      data-map-occluder="bottom"
      role="group"
      aria-labelledby="forecast-year-label"
    >
      <div className={styles.yearBarHead}>
        <label id="forecast-year-label" htmlFor="forecast-year">
          Forecast year · whole fire
        </label>
        <span className={styles.yearBarValue} aria-hidden>
          {estimate.year} · curve {formatShare(estimate.value)}
          {!estimate.reliable && ' · extrapolation'}
        </span>
      </div>
      <input
        id="forecast-year"
        type="range"
        min={curve.summer}
        max={curve.endYear}
        step={1}
        value={estimate.year}
        aria-valuetext={valueText}
        aria-describedby="forecast-year-note"
        onChange={(event) => onYear(Number(event.target.value))}
      />
      <div className={styles.yearBarFoot}>
        <span id="forecast-year-note">
          <span className={styles.longNote}>
            Map grid: summer {curve.summer} observation, unchanged by this slider
          </span>
          <span className={styles.shortNote}>Grid stays at summer {curve.summer}</span>
        </span>
        {estimate.year !== curve.summer && (
          <button type="button" onClick={() => onYear(curve.summer)}>
            Back to {curve.summer}
          </button>
        )}
      </div>
    </div>
  );
}
