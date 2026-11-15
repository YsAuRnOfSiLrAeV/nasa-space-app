import type { FireData } from '@/data/fireSchema';
import { formatForecastPercent } from '@/domain/fire/forecastFormatting';
import { UNAVAILABLE } from '@/domain/fire/fireSummary';
import styles from './FireResults.module.css';

export function PipelineForecastSummary({ data }: { data: FireData }) {
  const forecast = data.result.growth_forecast;
  if (!forecast?.series) return null;
  const summer = data.result.satellite_images.summer;
  const now = forecast.series.years.indexOf(summer);
  return (
    <section className={styles.section} aria-label="Backend supplied forecast summary">
      <h4>Supplied whole-fire growth forecast</h4>
      <dl className={styles.stats}>
        <div>
          <dt>Growth-model estimate · {summer}</dt>
          <dd>{formatForecastPercent(forecast.series.recovery[now])}</dd>
        </div>
        <div>
          <dt>80% forecast interval at {summer} · interval_80_now</dt>
          <dd>
            {forecast.interval_80_now
              ? `${formatForecastPercent(forecast.interval_80_now[0])} – ${formatForecastPercent(forecast.interval_80_now[1])}`
              : 'Not supplied · no interval inferred'}
          </dd>
        </div>
        <div>
          <dt>Supplied year reaching 80% of reference forest height</dt>
          <dd>{forecast.year_80pct ?? UNAVAILABLE}</dd>
        </div>
        <div>
          <dt>Supplied years after fire to 80%</dt>
          <dd>{forecast.years_to_80pct ?? UNAVAILABLE}</dd>
        </div>
      </dl>
      <p>
        Source: growth_forecast.series and interval_80_now. The growth-model estimate is separate
        from the current forest-state estimate. Spatial cell layers are unchanged by this forecast.
      </p>
    </section>
  );
}
