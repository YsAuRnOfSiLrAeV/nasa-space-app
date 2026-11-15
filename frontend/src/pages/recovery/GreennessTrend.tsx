import { greennessTrend } from '@/lib/greennessTrend';
import type { RecoveryFile } from '@/data/recoverySchema';
import ui from '@/components/shell/primitives.module.css';

export function GreennessTrend({ record }: { record: RecoveryFile }) {
  const trend = greennessTrend(record.ndvi, record.fire_year);
  const rate = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(4)}`;
  return (
    <section
      aria-label="Greenness trend evidence"
      className="space-y-3 border-t border-rule pt-5 text-sm"
    >
      <h4 className="type-section font-medium">Post-fire greenness change</h4>
      {trend ? (
        <>
          <p>
            Burned minus unburned NDVI changes by{' '}
            <strong className="font-medium text-foreground">{rate(trend.slope)} per year</strong>{' '}
            over {trend.from}–{trend.to}, using {trend.n} paired summers.
          </p>
          <p className="text-muted-foreground">
            Approximate 95% interval {rate(trend.interval[0])} to {rate(trend.interval[1])} NDVI per
            year. {trend.missing} unpaired summers inside that period are excluded.
          </p>
          <details>
            <summary className={`${ui.micro} cursor-pointer py-2`}>Method and uncertainty</summary>
            <p className="mt-2 leading-relaxed text-muted-foreground">
              A linear fit uses each year’s burned-minus-reference median after the fire year.
              Positive slopes mean that difference increases. Newey–West covariance with Bartlett
              weights allows residual dependence up to {trend.lags} calendar years. The interval
              uses a normal approximation and remains exploratory, especially for short or nonlinear
              records. Changing sample coverage and sensor effects can influence it.{' '}
              {trend.residualLag1 === null
                ? 'A lag-one residual diagnostic is unavailable.'
                : `Lag-one residual correlation is ${trend.residualLag1.toFixed(2)}.`}
            </p>
            <p className="mt-2 leading-relaxed text-muted-foreground">
              This analysis describes optical greenness. Model accuracy and structural recovery
              require their own validation.
            </p>
            <p className="mt-3">
              <a
                className="underline underline-offset-4"
                href="https://www.statsmodels.org/stable/generated/statsmodels.stats.sandwich_covariance.cov_hac.html"
                target="_blank"
                rel="noreferrer"
              >
                Newey–West method reference
              </a>
            </p>
          </details>
        </>
      ) : (
        <p className="text-muted-foreground">
          At least three summers with both burned and reference observations are needed to estimate
          a post-fire trend.
        </p>
      )}
    </section>
  );
}
