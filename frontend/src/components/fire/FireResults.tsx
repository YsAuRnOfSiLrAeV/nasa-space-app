import type { FireData } from '@/data/fireSchema';
import { missingResults } from '../../domain/fire/fireSummary';
import { type ForecastStatus } from '../../domain/fire/growthForecast';
import styles from './FireResults.module.css';

import { ForecastSection } from './FireForecast';
import { ObservedState } from './ObservedFireState';

export function FireResults({
  data,
  forecast,
  year,
}: {
  data: FireData;
  forecast: ForecastStatus;
  /** Selected forecast year (the observation summer when nothing is selected). */
  year: number;
}) {
  const { result } = data;
  const missing = missingResults(result).filter(
    (m) => !(m === 'growth forecast' && forecast.status !== 'none'),
  );
  return (
    <div className={styles.results}>
      <ObservedState data={data} missing={missing} />
      {forecast.status === 'valid' && (
        <ForecastSection
          curve={forecast.curve}
          observed={result.model_result.recovery_today_avg}
          year={year}
        />
      )}
      {forecast.status === 'unsupported' && (
        <section aria-labelledby="fire-forecast-title" className={styles.section}>
          <h4 id="fire-forecast-title" className={styles.heading}>
            Forecast · whole fire
          </h4>
          <p>{forecast.reason}</p>
        </section>
      )}
    </div>
  );
}
