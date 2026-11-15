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
  return (
    <section className={styles.section} aria-label="Supplied fire-level forecast summary">
      <h4>Fire-level recovery · supplied model 2</h4>
      {model.forecast !== 'growth' && (
        <p>No supported recovery forecast: {model.reason ?? 'not supplied for this fire'}.</p>
      )}
      <dl className={styles.stats}>
        <div>
          <dt>Current modeled recovery · {summer}</dt>
          <dd data-source="model2.now_recovery" data-value={model.now_recovery ?? 'missing'}>
            {formatForecastPercent(model.now_recovery)}
          </dd>
        </div>
        <div>
          <dt>Supplied 80% summary interval (interval_80)</dt>
          <dd data-source="model2.interval_80">
            {model.interval_80
              ? `${formatForecastPercent(model.interval_80[0])} – ${formatForecastPercent(model.interval_80[1])}`
              : 'Not supplied · no interval inferred'}
          </dd>
        </div>
        <div>
          <dt>Year reaching 80% of reference forest height (year_80pct)</dt>
          <dd>{model.year_80pct ?? UNAVAILABLE}</dd>
        </div>
        <div>
          <dt>Years after fire to 80% · supplied</dt>
          <dd>{model.years_to_80pct ?? UNAVAILABLE}</dd>
        </div>
      </dl>
      <p>
        Recovery is relative to reference forest height, not a probability. These are whole-fire
        modeled estimates. The spatial cell timeline is separate and is not adjusted by the forecast
        slider.
      </p>
      {model.valid_region && <p>Supplied model region: {model.valid_region}</p>}
      <p>{bundle.source.reliability.model2 ?? 'No model-2 reliability statement supplied.'}</p>
      {(model.warnings ?? []).length > 0 && (
        <ul aria-label="Forecast reliability warnings">
          {model.warnings!.map((code) => (
            <li key={code}>
              {warningText(code)} <code>{code}</code>
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
