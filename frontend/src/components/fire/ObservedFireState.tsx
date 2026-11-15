import type { FireData } from '@/data/fireSchema';
import {
  comparisonRows,
  formatError,
  formatShare,
  isProvided,
  neighbourForest,
  stageSegments,
  UNAVAILABLE,
} from '../../domain/fire/fireSummary';
import styles from './FireResults.module.css';

export function ObservedState({ data, missing }: { data: FireData; missing: string[] }) {
  const { result } = data;
  if (data.bundle)
    return (
      <section className={styles.section}>
        <p className={styles.kicker}>
          Supplied forestrecovery {data.bundle.metadata.library_version} export
        </p>
        <h4>Forest state · summer {result.satellite_images.summer}</h4>
        <dl className={styles.stats}>
          <div>
            <dt>Mean relative forest ranking score</dt>
            <dd>{data.bundle.source.model1?.mean?.toFixed(3) ?? UNAVAILABLE}</dd>
            <dd>Not a calibrated probability or recovery percentage.</dd>
          </div>
          <div>
            <dt>Excluded share</dt>
            <dd>{formatShare(data.bundle.source.model1?.excluded_share)}</dd>
          </div>
          <div>
            <dt>Reference forest height</dt>
            <dd>{result.neighbour_forest?.height_m ?? UNAVAILABLE} m</dd>
            <dd>{result.neighbour_forest?.source}</dd>
          </div>
        </dl>
        <p>
          Cell height is modeled. GEDI canopy height is measured. Fire-level growth forecasts are
          separate from the cell timeline.
        </p>
        {Object.entries(data.bundle.source.reliability)
          .filter(([key]) => key !== 'model2')
          .map(([key, text]) => (
            <p key={key}>{text}</p>
          ))}
      </section>
    );
  const model = result.model_result;
  const summer = result.satellite_images.summer;
  const forest = neighbourForest(result.neighbour_forest);
  const stages = stageSegments(model.stage_share);
  return (
    <section aria-labelledby="fire-observed-title" className={styles.section}>
      <p className={styles.kicker}>Current modeled state · not a measurement or forecast</p>
      <h4 id="fire-observed-title" className={styles.heading}>
        State in summer {summer}
      </h4>
      <p>
        Model estimates from summer {summer} imagery. The grid on the map shows this state and stays
        at {summer} whatever forecast year is selected.
      </p>
      <dl className={styles.stats}>
        <div>
          <dt>Whole-fire recovery today</dt>
          <dd data-value={stat(model.recovery_today_avg)}>
            {formatShare(model.recovery_today_avg)}
          </dd>
          {model.accuracy ? (
            <dd>
              Share of reference forest height over valid burned-area cells. See the excluded share
              and regional calibration context below.
            </dd>
          ) : (
            <dd className={styles.sub}>
              Share of the neighbouring forest’s height · validated error{' '}
              <span data-value={stat(model.error_vs_lidar_pct)}>
                {formatError(model.error_vs_lidar_pct)}
              </span>{' '}
              versus GEDI lidar on unseen fires
            </dd>
          )}
        </div>
        <div>
          <dt>Area recovered to 80%</dt>
          <dd data-value={stat(model.area_recovered_80pct)}>
            {formatShare(model.area_recovered_80pct)}
          </dd>
          <dd className={styles.sub}>
            of the burned area at ≥80% of the neighbouring forest’s height
          </dd>
        </div>
        <div>
          <dt>Neighbouring forest height</dt>
          <dd data-value={stat(result.neighbour_forest?.height_m)}>{forest.height}</dd>
          <dd className={styles.sub}>Source: {forest.source}. This height is “100% recovery”.</dd>
        </div>
      </dl>

      <StageBar stages={stages} />
      <Comparison data={data} />

      {missing.length > 0 && (
        <p className={styles.missing} role="note">
          Not supplied in this export: {missing.join(', ')}. These are shown as “{UNAVAILABLE}”,
          never as zero or as an estimate.
        </p>
      )}
    </section>
  );
}

const stat = (value: number | null | undefined) => (isProvided(value) ? String(value) : 'missing');

function Comparison({ data }: { data: FireData }) {
  const { result } = data;
  const { rows, missing, comparable } = comparisonRows(result.comparison);
  if (!comparable)
    return (
      <div className={styles.block}>
        <h5 className={styles.subheading}>Optical, model and lidar</h5>
        <p>
          {rows.length === 0
            ? 'No comparison values are supplied, so there is nothing to compare.'
            : `Only one perspective (${rows[0]!.label}) is supplied; a comparison needs at least two.`}
        </p>
      </div>
    );
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className={styles.block}>
      <h5 className={styles.subheading}>Optical, model and lidar · recovery today</h5>
      <table className={styles.compare}>
        <caption className="sr-only">Whole-fire recovery as supplied by each perspective</caption>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <th scope="row">
                {r.label}
                <small>{r.basis}</small>
              </th>
              <td>
                <span aria-hidden className={styles.compareTrack}>
                  <span style={{ width: `${(r.value / max) * 100}%` }} />
                </span>
                <span className={styles.figure} data-value={String(r.value)}>
                  {formatShare(r.value)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className={styles.sub}>
        Optical greenness returns with grasses and shrubs, before tall forest does, so it reads
        higher than structure. {missing.length > 0 && `Not supplied: ${missing.join(', ')}. `}
        {result.comparison &&
          `GEDI lidar points inside the fire: ${result.comparison.lidar_points_in_fire}.`}
      </p>
    </div>
  );
}

function StageBar({ stages }: { stages: ReturnType<typeof stageSegments> }) {
  if (!stages)
    return (
      <div className={styles.block}>
        <h5 className={styles.subheading}>Forest-stage proportions</h5>
        <p data-value="missing">{UNAVAILABLE}: the export does not supply stage shares.</p>
      </div>
    );
  const total = stages.reduce((sum, s) => sum + s.share, 0);
  return (
    <div className={styles.block}>
      <h5 className={styles.subheading}>Forest-stage proportions · burned area</h5>
      <div
        className={styles.stageBar}
        role="img"
        aria-label={stages.map((s) => `${s.label} ${formatShare(s.share)}`).join(', ')}
      >
        {stages.map((s) =>
          s.share > 0 ? (
            <span key={s.label} style={{ flexGrow: s.share, background: `var(${s.token})` }} />
          ) : null,
        )}
      </div>
      <ul className={styles.stageKey}>
        {stages.map((s) => (
          <li key={s.label}>
            <span aria-hidden className={styles.swatch} style={{ background: `var(${s.token})` }} />
            {s.label}
            <span className={styles.figure}>{formatShare(s.share)}</span>
          </li>
        ))}
      </ul>
      <p className={styles.sub}>
        Same colours as the map’s forest-stage layer.
        {Math.abs(total - 1) > 0.015 && ` The supplied shares sum to ${formatShare(total)}.`}
      </p>
    </div>
  );
}
