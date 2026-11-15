import {
  curveValue,
  estimateFor,
  withinReliableAge,
  type GrowthCurve,
} from '../../domain/fire/growthForecast';
import { formatShare } from '../../domain/fire/fireSummary';
import styles from './FireResults.module.css';
import { formatForecastPercent } from '@/domain/fire/forecastFormatting';

/** The fire's cell timeline, when it has one: the bar then drives the map. */
export interface YearBarCells {
  /** The years `timeline.json` supplies. */
  years: readonly number[];
  /** The year whose modeled cell recovery the map shows; null while the map shows another layer. */
  year: number | null;
  /** Show a year's modeled cell recovery on the map, or null to go back to the chosen layer. */
  onYear: (year: number | null) => void;
}

/**
 * The year slider along the bottom of the map. Rendered only for a valid forecast.
 *
 * For a fire with a cell timeline it is the map's year: moving it shows every
 * cell's modeled recovery for that year, and the readout gives the whole-fire
 * curve for the same year. Without a timeline it changes the fire-level forecast
 * readout and chart only, and says the map cannot follow. The camera never moves.
 */
export function ForecastYearBar({
  curve,
  year,
  onYear,
  cells,
  embedded = false,
  hideBack = false,
}: {
  curve: GrowthCurve;
  year: number;
  onYear: (year: number) => void;
  cells?: YearBarCells | null;
  /** Inside another bar (the selected fire's bottom bar): no own position or frame. */
  embedded?: boolean;
  /** The host renders the "Back to" action itself (see `backToNow`). */
  hideBack?: boolean;
}) {
  const formatValue = curve.series ? formatForecastPercent : formatShare;
  if (cells?.years.length)
    return (
      <CellYearBar
        curve={curve}
        year={year}
        cells={cells}
        embedded={embedded}
        hideBack={hideBack}
      />
    );

  const estimate = estimateFor(curve, year);
  const kind = estimate.year === curve.summer ? 'forecast at the observation summer' : 'forecast';
  const valueText = `${estimate.year}, ${kind}: expected recovery ${formatValue(estimate.value)}${
    estimate.reliable === false ? ', extrapolation outside the validated ages' : ''
  }. Map grid unchanged, summer ${curve.summer}.`;
  return (
    <div
      className={embedded ? styles.yearBarEmbedded : styles.yearBar}
      data-map-occluder={embedded ? undefined : 'bottom'}
      role="group"
      aria-labelledby="forecast-year-label"
    >
      <div className={styles.yearBarHead}>
        <label id="forecast-year-label" htmlFor="forecast-year">
          Recovery by year
        </label>
        <span className={styles.yearBarHeadRight}>
          {!hideBack && estimate.year !== curve.summer && (
            <button type="button" onClick={() => onYear(curve.summer)}>
              Back to {curve.summer}
            </button>
          )}
          <span className={styles.yearBarValue} aria-hidden>
            {estimate.reliable === false && (
              <span className={styles.yearBarFlag}>extrapolation</span>
            )}
            {estimate.year} · {formatValue(estimate.value)}
          </span>
        </span>
      </div>
      <input
        id="forecast-year"
        type="range"
        min={Math.min(
          curve.endYear,
          Math.max(curve.summer, curve.series?.years[0] ?? curve.summer),
        )}
        max={curve.endYear}
        step={1}
        value={estimate.year}
        aria-valuetext={valueText}
        onChange={(event) => onYear(Number(event.target.value))}
      />
    </div>
  );
}

/** The supplied year closest to `year`. */
const nearest = (years: readonly number[], year: number) =>
  years.reduce((best, y) => (Math.abs(y - year) < Math.abs(best - year) ? y : best));

/** The timeline from the observation summer (now) onward: earlier years are not offered. */
const fromNow = (years: readonly number[], summer: number) => {
  const start = nearest(years, summer);
  return years.filter((y) => y >= start);
};

/**
 * The bar's "Back to <now>" action, for a host that shows it outside the bar:
 * null while the bar already sits at the observation summer.
 */
export function backToNow(
  curve: GrowthCurve,
  year: number,
  onYear: (year: number) => void,
  cells?: YearBarCells | null,
): { year: number; go: () => void } | null {
  if (cells?.years.length) {
    const years = fromNow(cells.years, curve.summer);
    const summer = years[0]!;
    const shown = nearest(years, cells.year ?? year);
    return cells.year !== null && shown !== summer
      ? { year: summer, go: () => cells.onYear(summer) }
      : null;
  }
  return estimateFor(curve, year).year !== curve.summer
    ? { year: curve.summer, go: () => onYear(curve.summer) }
    : null;
}

/** The bar for a fire with a cell timeline: the map's year, with the whole-fire value beside it. */
function CellYearBar({
  curve,
  year,
  cells,
  embedded,
  hideBack,
}: {
  curve: GrowthCurve;
  year: number;
  cells: YearBarCells;
  embedded: boolean;
  hideBack: boolean;
}) {
  const formatValue = curve.series ? formatForecastPercent : formatShare;
  const years = fromNow(cells.years, curve.summer);
  const shown = nearest(years, cells.year ?? year);
  const onMap = cells.year !== null;
  const value = curveValue(curve, shown);
  const extrapolation = withinReliableAge(curve, shown) === false;
  const when =
    shown < curve.summer
      ? `modeled back from summer ${curve.summer}`
      : shown === curve.summer
        ? `modeled state, summer ${curve.summer}`
        : 'modeled projection';
  const summer = years[0]!;
  return (
    <div
      className={embedded ? styles.yearBarEmbedded : styles.yearBar}
      data-map-occluder={embedded ? undefined : 'bottom'}
      role="group"
      aria-labelledby="forecast-year-label"
    >
      <div className={styles.yearBarHead}>
        <label id="forecast-year-label" htmlFor="forecast-year">
          Recovery by year
        </label>
        <span className={styles.yearBarHeadRight}>
          {!hideBack && onMap && shown !== summer && (
            <button type="button" onClick={() => cells.onYear(summer)}>
              Back to {summer}
            </button>
          )}
          <span className={styles.yearBarValue} aria-hidden>
            {extrapolation && <span className={styles.yearBarFlag}>extrapolation</span>}
            {shown} · {formatValue(value)}
          </span>
        </span>
      </div>
      <input
        id="forecast-year"
        type="range"
        min={0}
        max={years.length - 1}
        step={1}
        value={years.indexOf(shown)}
        aria-valuetext={`${shown}, ${when}${onMap ? ', cells shown on the map' : ''}; recovery estimate ${formatValue(value)}${extrapolation ? ', extrapolation outside the validated ages' : ''}.`}
        aria-describedby={onMap ? 'forecast-year-note' : undefined}
        onChange={(event) => cells.onYear(years[Number(event.target.value)]!)}
      />
      {onMap && (
        <div className={styles.yearBarFoot}>
          <span id="forecast-year-note">
            <span className={styles.longNote}>Modeled cell recovery, {shown}. Not observed.</span>
            <span className={styles.shortNote}>Modeled cells, {shown}. Not observed.</span>
          </span>
          <button type="button" onClick={() => cells.onYear(null)}>
            Hide modeled cells
          </button>
        </div>
      )}
    </div>
  );
}
