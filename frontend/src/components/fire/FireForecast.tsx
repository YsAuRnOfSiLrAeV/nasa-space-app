import { formatShare, isProvided, UNAVAILABLE } from '../../domain/fire/fireSummary';
import { estimateFor, type GrowthCurve } from '../../domain/fire/growthForecast';
import styles from './FireResults.module.css';
import { ForecastChart } from './ForecastChart';
import { formatForecastPercent } from '@/domain/fire/forecastFormatting';

export function ForecastSection({
  curve,
  observed,
  year,
}: {
  curve: GrowthCurve;
  observed: number | null;
  year: number;
}) {
  const estimate = estimateFor(curve, year);
  const formatValue = curve.series ? formatForecastPercent : formatShare;
  return (
    <section aria-labelledby="fire-forecast-title" className={styles.section}>
      <p className={styles.kicker}>Prediction · whole fire</p>
      <h4 id="fire-forecast-title" className={styles.heading}>
        Recovery forecast
      </h4>
      <p>
        The supplied growth curve gives expected recovery for the whole fire by its age. It is one
        fire-level number per year: it does not recolour the grid or predict individual cells.
        Choose a year with the slider at the bottom of the map.
      </p>
      <ForecastChart curve={curve} observed={observed} year={estimate.year} />
      {/* Not a live region: the slider's value text already announces each year. */}
      <div className={styles.estimate} id="forecast-estimate">
        <span className={styles.estimateYear}>{estimate.year}</span>
        <dl className={styles.stats}>
          <div>
            <dt>Expected recovery · forecast</dt>
            <dd data-value={String(estimate.value)}>{formatValue(estimate.value)}</dd>
            {curve.reliableAge && (
              <dd className={styles.sub}>
                Fire age {estimate.age} ·{' '}
                {estimate.reliable
                  ? `within the validated ages ${curve.reliableAge[0]}–${curve.reliableAge[1]}`
                  : `outside the validated ages ${curve.reliableAge[0]}–${curve.reliableAge[1]}: extrapolation`}
              </dd>
            )}
          </div>
          {!curve.series && (
            <div>
              <dt>80% of neighbouring forest height</dt>
              <dd>
                {curve.year80 != null
                  ? curve.year80
                  : curve.yearsTo80 == null
                    ? UNAVAILABLE
                    : `${Math.round(curve.yearsTo80)} years after the fire`}
              </dd>
              <dd className={styles.sub}>
                {estimate.reached80
                  ? 'Reached on the curve by this year'
                  : 'Not yet reached on the curve'}{' '}
                · {curve.yearsTo80?.toFixed(1) ?? UNAVAILABLE} years after the fire (supplied)
              </dd>
            </div>
          )}
          <div>
            <dt>Selected-year 80% uncertainty bounds · {estimate.year}</dt>
            <dd data-value={curve.series ? 'supplied' : 'missing'}>
              {curve.series
                ? (() => {
                    const index = curve.series.years.indexOf(estimate.year);
                    return `Lower: ${formatValue(curve.series.low[index])} · Upper: ${formatValue(curve.series.high[index])} (80% bounds, supplied)`;
                  })()
                : UNAVAILABLE}
            </dd>
            <dd className={styles.sub}>
              {curve.series
                ? `Bounds come directly from ${curve.seriesSource ?? 'model2.series'}.low/high for this year. Missing bounds are marked Not available; the chart leaves gaps rather than interpolating uncertainty.`
                : 'The export supplies no forecast interval, so none is drawn. The validated error above applies to today’s estimate, not to the forecast.'}
            </dd>
          </div>
        </dl>
      </div>
      {isProvided(observed) && (
        <p className={styles.sub}>
          {curve.seriesSource === 'growth_forecast.series'
            ? `The ${curve.summer} current forest-state estimate (${formatValue(observed)}) is supplied as model_result.recovery_today_avg and marked separately. The growth forecast is not adjusted to match it.`
            : curve.series
              ? `The ${curve.summer} current modeled recovery (${formatValue(observed)}) is supplied as model2.now_recovery and marked separately. The series is not adjusted to fit this value.`
              : `The curve describes a typical fire of this age; this fire’s ${curve.summer} model estimate (${formatValue(observed)}) is plotted separately and does not adjust it.`}
        </p>
      )}
    </section>
  );
}
