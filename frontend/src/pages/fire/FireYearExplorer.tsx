import { useMemo, useState } from 'react';
import type { FireData } from '@/data/fireSchema';
import {
  canPreview,
  forecastEndYear,
  outsideReliableAge,
  previewFire,
  previewRecovery,
} from './fireForecast';
import { FireSpatialView } from './FireSpatialView';
import { percent } from './fireSpatial';
import styles from './Fire.module.css';

export function FireYearExplorer({ data }: { data: FireData }) {
  const { result } = data;
  const summer = result.satellite_images.summer;
  const mock = result.warnings.includes('MOCK_RESULT');
  const [year, setYear] = useState(summer);
  const enabled = canPreview(result);
  const end = enabled ? forecastEndYear(result) : summer;
  const projected = year > summer;
  const shown = useMemo(() => previewFire(data, year), [data, year]);
  const recovery =
    projected && enabled
      ? previewRecovery(
          result.model_result.recovery_today_avg,
          year - summer,
          result.growth_forecast!.tau!,
        )
      : result.model_result.recovery_today_avg;
  return (
    <section aria-labelledby="fire-years-title" className={styles.yearExplorer}>
      <div className={styles.yearHeading}>
        <h2 id="fire-years-title" className={styles.sectionTitle}>
          Explore recovery through time
        </h2>
        <output htmlFor="fire-year" aria-live="polite" className={styles.yearOutput}>
          {year}{' '}
          <span>
            {projected
              ? 'Forecast preview'
              : mock
                ? 'Illustrative mock state'
                : 'Supplied model state'}
          </span>
        </output>
      </div>
      <label htmlFor="fire-year" className="text-sm">
        Summer year
      </label>
      <input
        id="fire-year"
        className={styles.yearSlider}
        type="range"
        min={summer}
        max={end}
        step={1}
        value={year}
        disabled={!enabled}
        aria-describedby="fire-year-basis"
        aria-valuetext={`${year}, ${projected ? 'forecast preview' : mock ? 'illustrative mock state' : 'supplied model state'}`}
        onChange={(event) => setYear(Number(event.target.value))}
      />
      <div className={styles.yearTicks}>
        <span>
          {summer} · {mock ? 'mock state' : 'supplied state'}
        </span>
        {enabled && <span>{end} · preview horizon</span>}
      </div>
      {enabled && (
        <div className={styles.yearActions}>
          <button type="button" onClick={() => setYear(summer)}>
            Return to {summer}
          </button>
          {result.growth_forecast?.year_80pct != null &&
            result.growth_forecast.year_80pct >= summer && (
              <button type="button" onClick={() => setYear(result.growth_forecast!.year_80pct!)}>
                View supplied milestone year · {result.growth_forecast.year_80pct}
              </button>
            )}
        </div>
      )}
      <p className="mt-4 text-sm" aria-live="polite">
        {projected || mock ? 'Illustrative mean recovery' : 'Supplied mean recovery'}:{' '}
        <strong>{percent(recovery, 100)}</strong>
        {' · '}
        {year - result.fire.year} years after the fire.
        {outsideReliableAge(result, year) &&
          ' Outside the supplied reliable fire-age range: extrapolation.'}
      </p>
      {enabled && <GrowthChart data={data} year={year} end={end} />}
      <div id="fire-year-basis" className={styles.notice}>
        <p>
          {mock
            ? `This is an illustrative mock grid for summer ${summer}. No imagery was processed.`
            : `The model uses summer imagery (July–August). The supplied spatial estimate is for ${summer}.`}
        </p>
        {enabled ? (
          <>
            <p className="mt-2">
              Preview assumption: recovery approaches the neighbouring forest’s height using the
              supplied time constant τ = {result.growth_forecast!.tau} years, starting from the{' '}
              {summer} estimate. This equation needs confirmation by the model owner; it has no
              supplied uncertainty interval.
            </p>
            <p className="mt-2">
              The map projects only burned cells with forecast coverage. Empty and state-only cells
              have no future estimate. Reference cells retain their supplied values. Height stages,
              NDVI and GEDI are not projected.
            </p>
            {result.growth_forecast?.year_80pct != null && (
              <p className="mt-2">
                The export separately reports 80% recovery in {result.growth_forecast.year_80pct}.
                That milestone is not fitted to this preview curve.
              </p>
            )}
            <p className="mt-2">
              Supplied reliable fire ages: {result.growth_forecast!.reliable_age.join('–')} years.
              Historical states before {summer} have not been supplied.
            </p>
          </>
        ) : (
          <p className="mt-2">
            A supported growth method and time constant have not been supplied. The map remains at{' '}
            {summer}.
          </p>
        )}
      </div>
      <FireSpatialView data={shown} year={year} />
    </section>
  );
}

function GrowthChart({
  data: { result },
  year,
  end,
}: {
  data: FireData;
  year: number;
  end: number;
}) {
  const summer = result.satellite_images.summer;
  const base = result.model_result.recovery_today_avg;
  if (base == null)
    return (
      <p className="mt-4 text-sm">
        Mean recovery has not been supplied, so no mean curve is shown.
      </p>
    );
  const tau = result.growth_forecast!.tau!;
  const x = (y: number) => 52 + ((y - summer) / (end - summer)) * 612;
  const ceiling = Math.max(1, base);
  const y = (v: number) => 180 - (v / ceiling) * 154;
  const points = Array.from({ length: end - summer + 1 }, (_, i) => {
    const at = summer + i;
    return `${x(at)},${y(previewRecovery(base, i, tau)!)}`;
  }).join(' ');
  const milestone = result.growth_forecast?.year_80pct;
  return (
    <figure className={styles.growthChart}>
      <svg
        viewBox="0 0 700 220"
        role="img"
        aria-label={`Illustrative recovery curve from ${percent(base, 100)} in ${summer}. Selected year ${year}. Dashed lines mark 80% and the supplied reliable age limit.`}
      >
        {[0, 0.5, 0.8, ceiling]
          .filter((v, i, all) => all.indexOf(v) === i)
          .map((v) => (
            <g key={v}>
              <line
                x1="52"
                x2="664"
                y1={y(v)}
                y2={y(v)}
                stroke="var(--rule-strong)"
                strokeDasharray={v === 0.8 ? '5 4' : undefined}
              />
              <text x="42" y={y(v) + 4} textAnchor="end">
                {Math.round(v * 100)}%
              </text>
            </g>
          ))}
        {(() => {
          const limit = result.fire.year + result.growth_forecast!.reliable_age[1];
          return limit > summer && limit < end ? (
            <line
              x1={x(limit)}
              x2={x(limit)}
              y1="20"
              y2="180"
              stroke="var(--muted-foreground)"
              strokeDasharray="3 5"
            />
          ) : null;
        })()}
        <polyline
          points={points}
          fill="none"
          stroke="var(--stage-2)"
          strokeWidth="2.5"
          strokeDasharray="6 3"
        />
        {milestone != null && milestone >= summer && milestone <= end && (
          <rect x={x(milestone) - 4} y={y(0.8) - 4} width="8" height="8" fill="var(--foreground)">
            <title>Supplied 80% milestone: {milestone}. Separate from the preview curve.</title>
          </rect>
        )}
        <line x1={x(year)} x2={x(year)} y1="20" y2="180" stroke="var(--foreground)" />
        <circle
          cx={x(year)}
          cy={y(previewRecovery(base, year - summer, tau)!)}
          r="5"
          fill="var(--stage-2)"
          stroke="var(--background)"
          strokeWidth="2"
        />
        <text x="52" y="208">
          {summer}
        </text>
        <text x="664" y="208" textAnchor="end">
          {end}
        </text>
      </svg>
      <figcaption>
        Dashed curve · illustrative forward growth. Square · supplied 80% milestone. Vertical dashed
        line · upper reliable age limit.
      </figcaption>
    </figure>
  );
}
