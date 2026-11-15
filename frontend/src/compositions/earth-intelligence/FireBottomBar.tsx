import { ForecastYearBar, type YearBarCells } from '@/components/fire/ForecastYearBar';
import type { DemoFire } from '@/data/fireSchema';
import { fireLabel } from '@/domain/fire/fireLabel';
import { formatShare } from '@/domain/fire/fireSummary';
import type { GrowthCurve } from '@/domain/fire/growthForecast';
import type { FireInvestigationState } from '@/hooks/useFireInvestigation';
import styles from './MapShell.module.css';

/**
 * Along the bottom of the map while a fire is open: its key figures, recovery
 * timeline / forecast slider when available, and quick actions.
 */
export function FireBottomBar({
  investigation,
  entry,
  curve,
  year,
  onYear,
  cells,
  onFit,
  closeHref,
}: {
  investigation: FireInvestigationState;
  entry: DemoFire | undefined;
  curve: GrowthCurve | null;
  year: number | null;
  onYear: (year: number) => void;
  cells: YearBarCells | null;
  onFit: (() => void) | null;
  closeHref: string;
}) {
  const { data, fireId } = investigation;
  const name = fireId
    ? fireLabel(fireId)
        .replace(/ · #\d+$/, '')
        .replaceAll(' · ', ', ')
    : entry?.name.en;
  const fireYear = data?.result.fire.year ?? entry?.year;
  const bundle = data?.bundle;
  const now =
    bundle?.forecast.kind === 'growth'
      ? bundle.forecast.now_recovery
      : (data?.result.model_result.recovery_today_avg ?? null);
  const year80 =
    curve?.year80 ?? (bundle?.forecast.kind === 'growth' ? bundle.forecast.year_80pct : null);
  const figures = [
    data?.result.fire.area_ha != null && {
      label: 'Fire area',
      value: `${data.result.fire.area_ha.toLocaleString('en')} ha`,
    },
    now != null &&
      data && {
        label: 'Modeled recovery',
        value: `${formatShare(now)} · ${data.result.satellite_images.summer}`,
      },
    year80 != null &&
      data && {
        label: 'Modeled 80% recovery',
        // The supplied year the whole-fire curve reaches 80% of the reference forest height.
        value: year80 <= data.result.satellite_images.summer ? `reached ${year80}` : `by ${year80}`,
      },
  ].filter((figure): figure is { label: string; value: string } => Boolean(figure));

  return (
    <section className={styles.bottomBar} data-map-occluder="bottom" aria-label="Fire details">
      <div className={styles.bottomHead}>
        <p className={styles.bottomTitle}>
          <b>
            {name}
            {!fireId && fireYear ? ` · ${fireYear}` : ''}
          </b>
        </p>
        {figures.length > 0 && (
          <dl className={styles.bottomFigures}>
            {figures.map((figure) => (
              <div key={figure.label}>
                <dt>{figure.label}</dt>
                <dd>{figure.value}</dd>
              </div>
            ))}
          </dl>
        )}
        <div className={styles.bottomActions}>
          {onFit && (
            <button type="button" onClick={onFit}>
              Fit fire
            </button>
          )}
          <a href={closeHref} aria-label="Close fire and return to the fire list">
            Close fire
          </a>
        </div>
      </div>
      {curve && year !== null ? (
        <ForecastYearBar curve={curve} year={year} onYear={onYear} cells={cells} embedded />
      ) : (
        data && (
          <p className={styles.bottomNote}>
            No recovery timeline or forecast is supplied for this fire: the map shows its state in
            summer {data.result.satellite_images.summer}.
          </p>
        )
      )}
    </section>
  );
}
