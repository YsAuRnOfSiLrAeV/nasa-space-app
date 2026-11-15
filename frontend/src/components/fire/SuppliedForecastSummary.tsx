import type { FireData } from '@/data/fireSchema';
import { warningText } from '@/data/fireWarnings';
import { UNAVAILABLE } from '@/domain/fire/fireSummary';
import { formatForecastPercent } from '@/domain/fire/forecastFormatting';
import styles from './FireResults.module.css';

/** The fire-level summary fields are displayed as supplied, separately from series and cell estimates. */
export function SuppliedForecastSummary({ data }: { data: FireData }) {
  const bundle = data.bundle!;
  const model = bundle.source.model2;
  const summer = data.result.satellite_images.summer;
  // Outside Canada there is no growth forecast: show nothing rather than a list of "Not available".
  if (model.forecast !== 'growth') return null;
  const [low, high] = model.interval_80 ?? [null, null];
  return (
    <section className={styles.section} aria-label="Supplied fire-level forecast summary">
      <h4>How far the forest has recovered</h4>
      {model.now_recovery != null && (
        <p>
          In {summer} this fire is about {formatForecastPercent(model.now_recovery)} recovered
          {low != null && high != null
            ? ` (likely between ${formatForecastPercent(low)} and ${formatForecastPercent(high)})`
            : ''}
          {model.year_80pct != null
            ? `. It is expected to reach 80% around ${model.year_80pct}.`
            : '.'}
        </p>
      )}
      <dl className={styles.stats}>
        <div>
          <dt>Recovery now · {summer}</dt>
          <dd data-source="model2.now_recovery" data-value={model.now_recovery ?? 'missing'}>
            {formatForecastPercent(model.now_recovery)}
          </dd>
        </div>
        <div>
          <dt>Likely range (80% confidence)</dt>
          <dd data-source="model2.interval_80">
            {model.interval_80
              ? `${formatForecastPercent(model.interval_80[0])} – ${formatForecastPercent(model.interval_80[1])}`
              : 'Not supplied'}
          </dd>
        </div>
        <div>
          <dt>Year it reaches 80% of the neighbouring forest’s height</dt>
          <dd>{model.year_80pct ?? UNAVAILABLE}</dd>
        </div>
        <div>
          <dt>Years after the fire</dt>
          <dd>{model.years_to_80pct ?? UNAVAILABLE}</dd>
        </div>
      </dl>
      <p>
        Recovery is relative to reference forest height, not a probability. These are whole-fire
        modeled estimates. The spatial cell timeline is separate and is not adjusted by the forecast
        slider.
      </p>
      <p>{bundle.source.reliability.model2 ?? 'No model-2 reliability statement supplied.'}</p>
      {(model.warnings ?? []).length > 0 && (
        <ul aria-label="Forecast reliability warnings">
          {model.warnings!.map((code) => (
            <li key={code} title={code}>
              {warningText(code)}
            </li>
          ))}
        </ul>
      )}
      <p>
        Source: {data.result.fire.id} · result.json → model2. The supplied summary interval and
        per-year series bounds are displayed separately; neither replaces the other.
      </p>
    </section>
  );
}
