import type { FireData } from '@/data/fireSchema';
import { formatShare } from '@/domain/fire/fireSummary';
import styles from './FireResults.module.css';

export function FireAccuracyContext({ data }: { data: FireData }) {
  const model = data.result.model_result;
  if (model.excluded_share === null && model.accuracy === null) return null;
  const accuracy = model.accuracy;
  return (
    <section className={styles.section} aria-label="Recovery coverage and calibration context">
      <h5>Recovery coverage and calibration context</h5>
      <dl className={styles.stats}>
        <div>
          <dt>Burned area excluded from the recovery average</dt>
          <dd>{formatShare(model.excluded_share)}</dd>
          <dd>
            Missing observations and out-of-training-range inputs can exclude cells. The average
            describes retained cells and may be optimistic.
          </dd>
        </div>
        {accuracy && (
          <>
            <div>
              <dt>Median fire-level error vs GEDI · regional validation</dt>
              <dd>{accuracy.error_vs_lidar_pct}% of reference forest height</dd>
            </div>
            <div>
              <dt>Fire-average height MAE</dt>
              <dd>{accuracy.mae_m} m</dd>
            </div>
            <div>
              <dt>Always-predict-the-average baseline MAE</dt>
              <dd>{accuracy.null_model_mae_m} m</dd>
            </div>
            <div>
              <dt>Validation sample</dt>
              <dd>
                {accuracy.n_fires} fires · at least {accuracy.min_gedi_points} GEDI points per fire
              </dd>
            </div>
          </>
        )}
      </dl>
      <p>
        {accuracy
          ? 'These are supplied regional validation statistics, not a confidence interval for this fire or a per-cell error guarantee. Extrapolated regions and alternative reference heights require the accompanying warnings.'
          : 'No regional accuracy statistics were supplied. No error bounds are inferred.'}
      </p>
    </section>
  );
}
