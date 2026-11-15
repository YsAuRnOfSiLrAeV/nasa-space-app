import { useEffect, useId, useMemo, useState } from 'react';
import type { DemoFire } from '@/data/fireSchema';
import type { FireBundle } from '@/data/fireTypes';
import { EMPTY_FIRES, useFireCatalog } from '@/hooks/useFireCatalog';
import { useFireData } from '@/hooks/useFireData';
import { usePrefersReducedMotion } from '@/hooks/useMediaQuery';
import {
  ForestViewer,
  REFERENCE_GROWTH,
  growthFromRecovery,
  standForFire,
  type GrowthParams,
} from '@/features/forest3d';
import styles from './forestGrowth.module.css';

const ILLUSTRATIVE = '';
type Compare = 'reference' | 'fire' | 'off';
type GrowthFire = FireBundle & { forecast: Extract<FireBundle['forecast'], { kind: 'growth' }> };

const pct = (share: number | null | undefined) =>
  share == null ? 'not supplied' : `${Math.round(share * 100)}%`;

/** The model's numbers for one year of one fire, and the scene parameters they drive. */
function yearOf(bundle: GrowthFire, year: number) {
  const series = bundle.forecast.series;
  const index = series.years.indexOf(year);
  const recovery = series.recovery[index] ?? null;
  const t = bundle.timeline;
  const row = t ? (t.recovery_pct[t.years.indexOf(year)] ?? null) : null;
  return {
    year,
    age: year - bundle.metadata.year,
    recovery,
    low: series.low[index] ?? null,
    high: series.high[index] ?? null,
    cells: row ? row.filter((value) => value !== null).length : 0,
    growth: growthFromRecovery({
      recoveryShare: recovery ?? 0,
      ageYears: year - bundle.metadata.year,
      cellRecovery: row,
    }),
  };
}

/**
 * Forest growth in 3D, driven by a fire's modeled recovery: pick a fire with a
 * growth forecast and a year, and compare it with the reference forest or the
 * fire year. Falls back to the static illustrative stand without data.
 */
export function ForestGrowthExplorer() {
  const id = useId();
  const catalog = useFireCatalog();
  const fires = (catalog.state.status === 'ready' ? catalog.state.data : EMPTY_FIRES).filter(
    (fire) => fire.capabilities?.forecast,
  );
  const [picked, setPicked] = useState<string | null>(null);
  const fireId = picked ?? fires[0]?.id ?? null;

  return (
    <div className={styles.explorer}>
      <div className={styles.picker}>
        <label htmlFor={`${id}-fire`}>Recovery from</label>
        <select
          id={`${id}-fire`}
          value={fireId ?? ILLUSTRATIVE}
          onChange={(event) => setPicked(event.target.value)}
        >
          <option value={ILLUSTRATIVE}>No fire · the illustrative stand</option>
          {fires.map((fire: DemoFire) => (
            <option key={fire.id} value={fire.id}>
              {fire.name.en} · fire of {fire.year}
            </option>
          ))}
        </select>
        {catalog.state.status === 'loading' && <p role="status">Loading the fires…</p>}
        {catalog.state.status === 'error' && (
          <p role="alert">The fire list could not be loaded; the illustrative stand is shown.</p>
        )}
      </div>
      {fireId ? <FireGrowth key={fireId} fireId={fireId} /> : <ForestViewer />}
    </div>
  );
}

function FireGrowth({ fireId }: { fireId: string }) {
  const { state, retry } = useFireData(fireId);
  if (state.status === 'loading' || state.status === 'idle')
    return <p role="status">Loading the fire’s modeled recovery…</p>;
  if (state.status !== 'ready')
    return (
      <div role="alert">
        <p>{state.status === 'error' ? state.message : `${fireId} is not in the fire catalog.`}</p>
        <button type="button" onClick={retry}>
          Try again
        </button>
      </div>
    );
  const bundle = state.data.bundle;
  if (!bundle || bundle.forecast.kind !== 'growth')
    return <p>This fire has no growth forecast, so there is no recovery to draw.</p>;
  return <GrowthPlayer bundle={bundle as GrowthFire} />;
}

function GrowthPlayer({ bundle }: { bundle: GrowthFire }) {
  const id = useId();
  const reduced = usePrefersReducedMotion();
  const years = bundle.forecast.series.years;
  const fireYear = bundle.metadata.year;
  const [year, setYear] = useState(() =>
    years.includes(bundle.metadata.summer) ? bundle.metadata.summer : years.at(-1)!,
  );
  const [compare, setCompare] = useState<Compare>('reference');
  const [playing, setPlaying] = useState(false);
  const after = useMemo(() => yearOf(bundle, year), [bundle, year]);
  const fireState = useMemo(() => yearOf(bundle, years[0]!), [bundle, years]);
  const position = years.indexOf(year);
  // One landscape per fire, built once: the same block in both panes and in every year.
  const stand = useMemo(
    () =>
      standForFire({
        id: bundle.metadata.id,
        region: /^([a-z]+)_/.exec(bundle.metadata.id)?.[1] ?? null,
        referenceHeightM: bundle.reference?.height_m ?? null,
        perimeter: bundle.perimeter,
      }),
    [bundle],
  );
  const burnKm = stand.burn
    ? `${Math.round(stand.burn.widthKm * 10) / 10} × ${Math.round(stand.burn.heightKm * 10) / 10} km`
    : null;

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(
      () =>
        setYear((current) => {
          const next = years[years.indexOf(current) + 1];
          if (next === undefined) {
            setPlaying(false);
            return current;
          }
          return next;
        }),
      reduced ? 1400 : 900,
    );
    return () => clearInterval(timer);
  }, [playing, years, reduced]);

  const beyond = bundle.warnings.includes('FORECAST_EXTRAPOLATES_BEYOND_AGE_36') && after.age > 36;
  const readout = (
    <p>
      {year}: modeled whole-fire recovery {pct(after.recovery)} of the reference forest height
      {after.low != null &&
        after.high != null &&
        ` (80% interval ${pct(after.low)}–${pct(after.high)})`}
      , {after.age} years after the fire.
    </p>
  );

  const before: { growth: GrowthParams; title: string; note: string } | null =
    compare === 'reference'
      ? {
          growth: REFERENCE_GROWTH,
          title: 'Before the fire · the reference forest',
          note: `What 100% means: the neighbouring forest${bundle.reference?.height_m ? `, ${bundle.reference.height_m} m` : ''}. Outline: this fire’s real perimeter.`,
        }
      : compare === 'fire'
        ? {
            growth: fireState.growth,
            title: `${fireYear} · the fire year`,
            note: `Modeled recovery ${pct(fireState.recovery)}. Fire-killed trunks still standing.`,
          }
        : null;

  return (
    <div className={styles.player}>
      <div className={styles.controls}>
        <p className={styles.readout}>
          <span className={styles.kicker}>Modeled · illustrated</span>
          <output className={styles.year} htmlFor={`${id}-year`}>
            {year}
          </output>
          <span>
            Whole-fire recovery <b>{pct(after.recovery)}</b>
            {after.low != null && after.high != null && (
              <>
                {' '}
                · 80% interval {pct(after.low)}–{pct(after.high)}
              </>
            )}
          </span>
          <span>
            Fire age {after.age} years
            {beyond && ' · beyond the validated ages: extrapolation'}
          </span>
        </p>
        <div className={styles.transport}>
          <button
            type="button"
            disabled={position <= 0}
            onClick={() => {
              setPlaying(false);
              setYear(years[position - 1]!);
            }}
          >
            Previous year
          </button>
          <button
            type="button"
            aria-pressed={playing}
            onClick={() => {
              if (playing) return setPlaying(false);
              if (position === years.length - 1) setYear(years[0]!);
              setPlaying(true);
            }}
          >
            {playing ? 'Pause' : 'Play'}
          </button>
          <button
            type="button"
            disabled={position >= years.length - 1}
            onClick={() => {
              setPlaying(false);
              setYear(years[position + 1]!);
            }}
          >
            Next year
          </button>
        </div>
        <input
          id={`${id}-year`}
          type="range"
          aria-label="Year shown"
          min={0}
          max={years.length - 1}
          value={position}
          aria-valuetext={`${year}, modeled recovery ${pct(after.recovery)}`}
          onChange={(event) => {
            setPlaying(false);
            setYear(years[Number(event.target.value)]!);
          }}
        />
        <div className={styles.range} aria-hidden>
          <span>{years[0]}</span>
          <span>{years.at(-1)}</span>
        </div>
        <label className={styles.compare}>
          Compare with
          <select value={compare} onChange={(event) => setCompare(event.target.value as Compare)}>
            <option value="reference">Before the fire (reference forest)</option>
            <option value="fire">The fire year</option>
            <option value="off">No comparison</option>
          </select>
        </label>
      </div>

      <div className={before ? styles.pair : undefined}>
        {before && (
          <ForestViewer
            stand={stand}
            growth={before.growth}
            compact
            label={{ index: 'BEFORE · ILLUSTRATIVE', title: before.title, note: before.note }}
            fallback={<p>{before.note}</p>}
          />
        )}
        <ForestViewer
          stand={stand}
          growth={after.growth}
          compact={Boolean(before)}
          label={{
            index: `${year} · ILLUSTRATIVE · NOT MEASURED`,
            title: `${bundle.metadata.id} · ${year}`,
            note: `Tree heights = modeled recovery ${pct(after.recovery)}${after.cells ? `, spread like ${after.cells} modeled cells` : ''}. Inside the outline: the burn${burnKm ? ` (${burnKm}, shape to scale)` : ''}; outside: unburned forest.`,
          }}
          fallback={readout}
        />
      </div>

      <details className={styles.method}>
        <summary>How the picture is driven</summary>
        <table>
          <caption className="sr-only">What each part of the illustration follows</caption>
          <thead>
            <tr>
              <th scope="col">In the picture</th>
              <th scope="col">Follows</th>
              <th scope="col">Kind</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Tree height</th>
              <td>
                The fire’s modeled whole-fire recovery for the year (result.json, model2.series) ×
                each tree’s mature height. 100% draws the reference forest.
              </td>
              <td>Model estimate</td>
            </tr>
            <tr>
              <th scope="row">Spread of heights</th>
              <td>
                Where the fire has a cell timeline: each tree takes one quantile of that year’s
                modeled cell recovery (timeline.json).
              </td>
              <td>Model estimate</td>
            </tr>
            <tr>
              <th scope="row">Number of young trees</th>
              <td>0.25 + 1.5 × recovery of the tree positions.</td>
              <td>Illustrative assumption</td>
            </tr>
            <tr>
              <th scope="row">Dead standing trunks</th>
              <td>Fall over time: exp(−years since fire / 20).</td>
              <td>Illustrative assumption</td>
            </tr>
            <tr>
              <th scope="row">Shrubs, broadleaf pioneers</th>
              <td>
                Shrubs fill open ground and recede as trees grow; broadleaf grows up to 1.5× faster
                while recovery is low.
              </td>
              <td>Illustrative assumption</td>
            </tr>
            <tr>
              <th scope="row">Burn outline and ground tone</th>
              <td>
                The fire’s real perimeter (result.json), drawn north-up and scaled to fit the block:
                the shape is real, the size is not. Inside it the forest regrows; outside it stands
                unburned.
              </td>
              <td>Data (shape), illustrative (scale)</td>
            </tr>
            <tr>
              <th scope="row">Tallest trees</th>
              <td>
                The neighbouring forest’s height for this fire (GEDI lidar median), relative to an
                18 m stand.
              </td>
              <td>Data</td>
            </tr>
            <tr>
              <th scope="row">Terrain, species, positions</th>
              <td>
                A synthetic landscape, different for each fire. Relief and species mix are typical
                of the region (mountain west, shield, eastern boreal), not measured at this site.
              </td>
              <td>Illustrative</td>
            </tr>
          </tbody>
        </table>
        <p>
          The terrain and trees are not a picture of {bundle.metadata.id}: they show how a stand
          would look at the modeled recovery, inside the fire’s real outline. Measured heights exist
          only at GEDI points, on the map.
        </p>
      </details>
    </div>
  );
}
