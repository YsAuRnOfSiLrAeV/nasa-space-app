import { useEffect, useMemo, useRef, useState } from 'react';
import type { Feature, Polygon } from 'geojson';
import { mapHref } from '@/app/route';
import type { StudyMapController } from '@/components/map/StudyMapController';
import { config } from '@/config';
import { useResource } from '@/hooks/useResource';
import { AnalysisClient } from '@/services/search/AnalysisClient';
import type {
  AtlasFilters,
  AtlasFire,
  AtlasSearch as Found,
  Run,
} from '@/services/search/contracts';
import { atlasDates, atlasSummary, isAtlasFire, percent } from '@/services/search/atlas';
import { geometryBounds } from '@/services/search/geometryBounds';
import styles from './MapShell.module.css';

const client = new AnalysisClient(config.apiBaseUrl);
const hectares = new Intl.NumberFormat('en', { maximumFractionDigits: 0 });

/**
 * Search of the backend fire atlas under the drawn polygon, and the recovery analysis of a chosen fire.
 * Renders nothing when no backend is configured: the exported catalog above keeps working without it.
 */
export function AtlasSearch({
  mapView,
  polygon,
  drawing,
  fireId,
  country,
  onPerimeters,
  onResult,
}: {
  mapView: StudyMapController | null;
  polygon: Polygon | null;
  drawing: boolean;
  fireId: string | null;
  country: string | undefined;
  /** Perimeters to draw on the map with the rest of the search geometry. */
  onPerimeters: (features: Feature[]) => void;
  onResult: (url: string, fireId: string) => Promise<void>;
}) {
  const [filters, setFilters] = useState({ yearFrom: '', yearTo: '', minAreaHa: '' });
  const [run, setRun] = useState<{ owner: string; value: Run } | null>(null);
  const [failure, setFailure] = useState<{ owner: string; message: string } | null>(null);
  const active = useRef<AbortController | null>(null);

  const query = useMemo<AtlasFilters>(
    () => ({
      yearFrom: Number(filters.yearFrom) || undefined,
      yearTo: Number(filters.yearTo) || undefined,
      minAreaHa: Number(filters.minAreaHa) || undefined,
    }),
    [filters],
  );
  const search = useResource<Found>(
    config.apiBaseUrl && polygon ? JSON.stringify([polygon.coordinates, query]) : null,
    (signal) => client.searchFires(polygon!, query, signal),
  );
  const found = search.state.status === 'ready' ? search.state.data : null;
  const listed = found?.fires.find((fire) => fire.id === fireId);
  // A fire opened from a link, or kept selected after the polygon changed.
  const fetched = useResource<AtlasFire>(
    config.apiBaseUrl && isAtlasFire(fireId) && !listed ? `fire:${fireId}` : null,
    (signal) => client.fire(fireId!, signal),
  );
  const selected = listed ?? (fetched.state.status === 'ready' ? fetched.state.data : null);
  const summers = useResource<number[]>(selected ? `summers:${selected.id}` : null, (signal) =>
    client.summers(selected!.id, signal),
  );
  const summer = summers.state.status === 'ready' ? summers.state.data[0] : undefined;
  const owner = `${selected?.id}:${summer}`;
  const visibleRun = run?.owner === owner ? run.value : null;
  const error = failure?.owner === owner ? failure.message : '';

  useEffect(() => {
    const features: Feature[] = (found?.fires ?? []).map((fire) => ({
      type: 'Feature',
      geometry: fire.perimeter,
      properties: { fireId: fire.id },
    }));
    if (selected && !listed)
      features.push({
        type: 'Feature',
        geometry: selected.perimeter,
        properties: { fireId: selected.id },
      });
    onPerimeters(features);
  }, [found, selected, listed, onPerimeters]);
  useEffect(() => () => onPerimeters([]), [onPerimeters]);
  useEffect(() => {
    if (!mapView || !selected) return;
    const [west, south, east, north] = geometryBounds(selected.perimeter);
    void mapView.focusBounds([
      [west, south],
      [east, north],
    ]);
  }, [mapView, selected]);
  useEffect(() => () => active.current?.abort(), [owner]);

  if (!config.apiBaseUrl) return null;

  const analyse = async () => {
    if (!selected || summer === undefined) return;
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    const update = (value: Run) => setRun({ owner, value });
    setFailure(null);
    try {
      const finished = await client.poll(
        await client.start(selected.id, summer, controller.signal),
        controller.signal,
        update,
      );
      update(finished);
      if (finished.status === 'complete') await onResult(finished.result, selected.id);
    } catch (problem) {
      if (!controller.signal.aborted)
        setFailure({
          owner,
          message: problem instanceof Error ? problem.message : 'Analysis failed.',
        });
    }
  };
  const field = (name: keyof typeof filters, label: string, step: number) => (
    <label>
      {label}
      <input
        type="number"
        min={0}
        step={step}
        value={filters[name]}
        onChange={(event) => setFilters({ ...filters, [name]: event.target.value })}
      />
    </label>
  );
  const pending = visibleRun?.status === 'pending';

  return (
    <section className={styles.atlas} aria-label="Global fire atlas">
      <h3>Global fire atlas</h3>
      {!polygon && !selected && (
        <p>
          Draw a polygon on the map to list every fire recorded under it since 2002, then analyse
          the recovery of the one you choose.
        </p>
      )}
      {polygon && (
        <div className={styles.atlasFilters}>
          {field('yearFrom', 'From year', 1)}
          {field('yearTo', 'To year', 1)}
          {field('minAreaHa', 'Min. area, ha', 100)}
        </div>
      )}
      {polygon && search.state.status === 'loading' && (
        <p role="status">Searching the atlas under this polygon…</p>
      )}
      {polygon && search.state.status === 'error' && (
        <div role="alert">
          <p>The fire atlas could not be searched: {search.state.message}</p>
          <button onClick={search.retry}>Retry search</button>
        </div>
      )}
      {found && (
        <p role={found.status === 'outside_regions' ? 'alert' : 'status'}>{atlasSummary(found)}</p>
      )}
      {found && found.fires.length > 0 && (
        <ul className={styles.fireList}>
          {found.fires.map((fire) => (
            <li key={fire.id}>
              <a
                aria-disabled={drawing || undefined}
                aria-current={fire.id === fireId ? 'true' : undefined}
                onClick={(event) => {
                  if (drawing) event.preventDefault();
                }}
                href={mapHref({ mode: 'search', presentation: 'fire', fireId: fire.id, country })}
              >
                {fire.year} · {hectares.format(fire.area_ha)} ha
                <small>
                  {atlasDates(fire)} ·{' '}
                  {fire.tier === 'A' ? 'verified model region' : 'extrapolated model region'}
                </small>
                {fire.overlap !== undefined && (
                  <small>{percent(fire.overlap)} of the fire inside the polygon</small>
                )}
              </a>
            </li>
          ))}
        </ul>
      )}
      {isAtlasFire(fireId) && !selected && fetched.state.status === 'loading' && (
        <p role="status">Loading the selected fire…</p>
      )}
      {isAtlasFire(fireId) && !selected && fetched.state.status === 'error' && (
        <p role="alert">The selected fire could not be loaded: {fetched.state.message}</p>
      )}
      {selected && (
        <div className={styles.note}>
          <h4>
            Fire of {selected.year} · {hectares.format(selected.area_ha)} ha
          </h4>
          <p>
            Burned {atlasDates(selected)} {selected.year}.{' '}
            {selected.tier === 'A'
              ? 'It lies in a region where the model is verified.'
              : 'It lies in a region where the model is extrapolated, not verified.'}
          </p>
          {summers.state.status === 'loading' && <p role="status">Checking satellite data…</p>}
          {summers.state.status === 'error' && (
            <p role="alert">Could not check satellite data: {summers.state.message}</p>
          )}
          {summers.state.status === 'ready' && summer === undefined && (
            <p role="status">
              This fire is too recent: the analysis needs a summer of satellite images taken after
              it burned.
            </p>
          )}
          {summer !== undefined && (
            <button disabled={drawing || pending} onClick={() => void analyse()}>
              {pending ? 'Analysing…' : `Analyse forest recovery · summer ${summer}`}
            </button>
          )}
          <div aria-live="polite">
            {pending && (
              <>
                <p>{visibleRun.step ?? 'Processing'} · this takes several minutes.</p>
                {visibleRun.progress !== undefined && (
                  <progress max={1} value={visibleRun.progress} />
                )}
              </>
            )}
            {visibleRun?.status === 'failed' && (
              <p role="alert">
                {visibleRun.message ?? 'The analysis failed'} ({visibleRun.code})
              </p>
            )}
            {visibleRun?.status === 'complete' && <p>Analysis ready: the result is shown below.</p>}
          </div>
          {error && <p role="alert">{error}</p>}
        </div>
      )}
    </section>
  );
}
