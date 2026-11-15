import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Polygon, FeatureCollection } from 'geojson';
import { mapHref, type MapState } from '@/app/route';
import type { StudyMapController } from '@/components/map/StudyMapController';
import { config } from '@/config';
import { FireIndexSchema } from '@/data/fireSchema';
import { useResource } from '@/hooks/useResource';
import { AnalysisClient } from '@/services/search/AnalysisClient';
import { simulateAnalysis } from '@/services/search/mockAnalysis';
import {
  CatalogSchema,
  CatalogFiresSchema,
  filterCatalog,
  ZonesSchema,
  type CatalogFire,
  type Run,
} from '@/services/search/contracts';
import { coverage, drawingPolygon } from '@/services/search/coverage';
import { boundaryOverlap, canAnalyze, precomputedHref } from '@/services/search/selection';
import styles from './MapShell.module.css';

async function json(path: string, signal: AbortSignal) {
  const response = await fetch(path, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Could not load catalog (${response.status}).`);
  return response.json();
}
const EMPTY: CatalogFire[] = [];
const client = new AnalysisClient(config.apiBaseUrl);

export function FireSearch({
  mapView,
  state,
  onResult,
}: {
  mapView: StudyMapController | null;
  state: MapState;
  onResult: (url: string, fireId: string) => Promise<void>;
}) {
  const [mock, setMock] = useState(() => import.meta.env.DEV && state.country === 'development');
  const country = state.country ?? '';
  const setCountry = (value: string) => {
    window.location.hash = mapHref({
      mode: 'search',
      presentation: 'explore',
      fireId: null,
      country: value,
    });
  };
  const [query, setQuery] = useState('');
  const [year, setYear] = useState('');
  const [drawing, setDrawing] = useState(false);
  const [points, setPoints] = useState<[number, number][]>([]);
  const [polygon, setPolygon] = useState<Polygon | null>(null);
  const [summer, setSummer] = useState('');
  const [run, setRun] = useState<Run | null>(null);
  const [runOwner, setRunOwner] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [failMock, setFailMock] = useState(false);
  const active = useRef<AbortController | null>(null);
  const base = `${config.dataBaseUrl}/catalog/`;
  const catalog = useResource('search-countries', async (signal) => {
    const data = await json(`${base}index.json`, signal);
    return data === null ? { countries: [] } : CatalogSchema.parse(data);
  });
  const countries = mock
    ? [{ code: 'development', name: 'Development fixtures', file: '' }]
    : catalog.state.status === 'ready'
      ? catalog.state.data.countries
      : [];
  const selectedCountry = countries.find((item) => item.code === country) ?? countries[0];
  const firesResource = useResource(
    selectedCountry ? `${mock}:${selectedCountry.code}` : null,
    async (signal) => {
      if (mock) {
        const response = await json(`${config.dataBaseUrl}/demo/index.json`, signal);
        return FireIndexSchema.parse(response).map((fire) => ({
          id: fire.id,
          name: fire.name.en,
          year: fire.year,
          center: fire.center_lonlat,
          perimeter: null,
          resultId: fire.id,
        }));
      }
      return CatalogFiresSchema.parse(await json(`${base}${selectedCountry!.file}`, signal));
    },
  );
  const zonesResource = useResource('search-zones', async (signal) => {
    const data = await json(`${base}zones.json`, signal);
    return data === null ? null : ZonesSchema.parse(data);
  });
  const zones = zonesResource.state.status === 'ready' ? zonesResource.state.data : null;
  const fires = firesResource.state.status === 'ready' ? firesResource.state.data : EMPTY;
  const selected = fires.find((fire) => fire.id === state.fireId);
  const ownsRun = runOwner === `${mock}:${selected?.id}:${chosenSummerKey(summer)}`;
  const visibleRun = ownsRun ? run : null;
  const processing = ownsRun && busy;
  const boundaryMatches = useMemo(
    () =>
      fires.map((fire) => {
        try {
          return { fire, overlap: boundaryOverlap(fire, polygon) };
        } catch {
          return { fire, overlap: null };
        }
      }),
    [fires, polygon],
  );
  const matchingFires = boundaryMatches
    .filter((match) => match.overlap !== null && match.overlap > 0)
    .map((match) => match.fire);
  const filtered = filterCatalog(matchingFires, query, year);
  const matchesBoundary = selected !== undefined && matchingFires.includes(selected);
  const summers = useResource(selected ? `${mock}:${selected.id}` : null, (signal) =>
    mock ? Promise.resolve([2026]) : client.summers(selected!.id, signal),
  );
  const choices = summers.state.status === 'ready' ? summers.state.data : [];
  const chosenSummer = choices.includes(Number(summer)) ? Number(summer) : choices[0];
  const evaluated = useMemo(() => {
    try {
      const boundary = polygon ?? fires.find((fire) => fire.id === state.fireId)?.perimeter;
      return { share: boundary ? coverage(boundary, zones) : null, error: '' };
    } catch {
      return {
        share: null,
        error: 'This polygon cannot be evaluated. Draw a simple boundary without crossings.',
      };
    }
  }, [polygon, zones, fires, state.fireId]);
  const selectedCoverage = useMemo(() => {
    try {
      const perimeter = fires.find((fire) => fire.id === state.fireId)?.perimeter;
      return perimeter ? coverage(perimeter, zones) : null;
    } catch {
      return null;
    }
  }, [fires, state.fireId, zones]);
  const analysisEnabled = canAnalyze({
    drawing,
    processing,
    summer: chosenSummer,
    mock,
    selectedCoverage,
    matchesBoundary,
  });
  const pick = useCallback(
    (id: string) => {
      if (!drawing)
        window.location.hash = mapHref({
          mode: 'search',
          presentation: 'fire',
          fireId: id,
          country: selectedCountry?.code,
        });
    },
    [drawing, selectedCountry?.code],
  );
  useEffect(() => {
    if (!mapView) return;
    mapView.showFireMarkers(
      fires.map((fire) => ({
        id: fire.id,
        label: `${fire.name} · ${fire.year}`,
        lonlat: fire.center,
      })),
      state.fireId,
      pick,
    );
    return () => mapView.hideFireMarkers();
  }, [mapView, fires, state.fireId, pick]);
  useEffect(() => {
    if (!mapView || !selected) return;
    if (selected.perimeter) {
      const coordinates =
        selected.perimeter.type === 'Polygon'
          ? selected.perimeter.coordinates.flat()
          : selected.perimeter.coordinates.flat(2);
      const longitude = coordinates.map((point) => point[0]);
      const latitude = coordinates.map((point) => point[1]);
      void mapView.focusBounds([
        [Math.min(...longitude), Math.min(...latitude)],
        [Math.max(...longitude), Math.max(...latitude)],
      ]);
    } else mapView.focus(selected.center, { minZoom: 8 });
  }, [mapView, selected]);
  useEffect(() => {
    if (!mapView) return;
    const features: FeatureCollection['features'] = fires.flatMap((fire) =>
      fire.perimeter
        ? [{ type: 'Feature' as const, geometry: fire.perimeter, properties: { fireId: fire.id } }]
        : [],
    );
    features.push(...(zones?.features ?? []));
    if (polygon) features.push({ type: 'Feature', geometry: polygon, properties: {} });
    if (points.length > 1)
      features.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: points },
        properties: {},
      });
    return mapView.showSearchGeometry({ type: 'FeatureCollection', features }, pick);
  }, [mapView, fires, zones, points, polygon, pick]);
  useEffect(
    () =>
      drawing && mapView
        ? mapView.onDrawPoint((point) => setPoints((previous) => [...previous, point]))
        : undefined,
    [drawing, mapView],
  );
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDrawing(false);
        setPoints([]);
      }
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, []);
  useEffect(() => () => active.current?.abort(), [state.fireId, mock, summer]);
  const analyze = async () => {
    if (!selected || !chosenSummer || !analysisEnabled) return;
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setRunOwner(`${mock}:${selected.id}:${chosenSummerKey(summer)}`);
    setError('');
    setRun(null);
    try {
      if (mock) {
        setRun(await simulateAnalysis(controller.signal, failMock, setRun));
      } else {
        const result = await client.poll(
          await client.start(selected.id, chosenSummer, controller.signal),
          controller.signal,
          setRun,
        );
        setRun(result);
      }
    } catch (failure) {
      if (!controller.signal.aborted)
        setError(failure instanceof Error ? failure.message : 'Analysis failed.');
    } finally {
      if (active.current === controller) setBusy(false);
    }
  };
  const finish = () => {
    try {
      setPolygon(drawingPolygon(points));
      setError('');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Invalid boundary.');
      return;
    }
    setDrawing(false);
    setPoints([]);
  };
  return (
    <section className={styles.search} aria-label="Find Your Fire workflow">
      {import.meta.env.DEV && (
        <label>
          <input
            type="checkbox"
            checked={mock}
            onChange={(event) => {
              setMock(event.target.checked);
              setCountry('');
            }}
          />{' '}
          Development-only mock services
        </label>
      )}
      {mock && (
        <p role="note">
          Development simulation using existing labelled example coordinates. No scientific analysis
          is performed.
        </p>
      )}
      <label>
        Country
        <select
          value={selectedCountry?.code ?? ''}
          onChange={(event) => setCountry(event.target.value)}
        >
          <option value="" disabled>
            Select country
          </option>
          {countries.map((item) => (
            <option key={item.code} value={item.code}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Fire name
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      <label>
        Fire year
        <input type="number" value={year} onChange={(event) => setYear(event.target.value)} />
      </label>
      {[catalog, firesResource].map((resource, index) =>
        resource.state.status === 'error' ? (
          <div role="alert" key={index}>
            <p>{resource.state.message}</p>
            <button onClick={resource.retry}>Retry catalog</button>
          </div>
        ) : resource.state.status === 'loading' ? (
          <p role="status" key={index}>
            Loading catalog…
          </p>
        ) : null,
      )}
      {!countries.length && catalog.state.status === 'ready' && (
        <p>No country catalogs supplied yet.</p>
      )}
      {firesResource.state.status === 'ready' && !filtered.length && (
        <p>
          {polygon
            ? 'No catalog fire perimeters overlap this boundary and match these filters.'
            : 'No fires match these filters.'}
        </p>
      )}
      {polygon && boundaryMatches.some((match) => match.overlap === null) && (
        <p>Some fires have no usable perimeter and cannot be checked against this boundary.</p>
      )}
      <ul className={styles.fireList}>
        {filtered.map((fire) => (
          <li key={fire.id}>
            <a
              aria-current={selected?.id === fire.id ? 'true' : undefined}
              href={mapHref({
                mode: 'search',
                presentation: 'fire',
                fireId: fire.id,
                country: selectedCountry?.code,
              })}
            >
              {fire.name} · {fire.year}
              <small>{fire.resultId ? 'Precomputed result available' : 'Catalog only'}</small>
              {polygon && (
                <small>
                  {(
                    (boundaryMatches.find((match) => match.fire === fire)?.overlap ?? 0) * 100
                  ).toFixed(1)}
                  % of fire inside boundary
                </small>
              )}
            </a>
          </li>
        ))}
      </ul>
      {state.fireId && !selected && firesResource.state.status === 'ready' && (
        <p role="status">This fire is not in the selected country catalog.</p>
      )}
      <fieldset>
        <legend>Selection boundary</legend>
        <button
          disabled={!mapView || drawing || processing}
          onClick={() => {
            setDrawing(true);
            setPolygon(null);
            setPoints([]);
          }}
        >
          Draw polygon
        </button>
        {drawing && (
          <>
            <p>
              Click the map to add vertices ({points.length}). Escape cancels. Keyboard users can
              add the map centre.
            </p>
            <button
              onClick={() => mapView && setPoints((previous) => [...previous, mapView.centre()])}
            >
              Add map centre
            </button>
            <button disabled={points.length < 3} onClick={finish}>
              Finish polygon
            </button>
            <button
              onClick={() => {
                setDrawing(false);
                setPoints([]);
              }}
            >
              Cancel drawing
            </button>
          </>
        )}
        {polygon && <button onClick={() => setPolygon(null)}>Clear polygon</button>}
      </fieldset>
      <p role="status">
        {drawing
          ? 'Finish or cancel drawing before requesting analysis.'
          : evaluated.error ||
            (evaluated.share === null
              ? 'Coverage cannot be evaluated: supply a boundary and applicability zones.'
              : `${(evaluated.share * 100).toFixed(1)}% supported coverage · ${evaluated.share === 0 ? 'unsupported' : evaluated.share >= 1 - 1e-8 ? 'supported' : 'partially supported'}`)}
      </p>
      {zonesResource.state.status === 'error' && (
        <button onClick={zonesResource.retry}>Retry applicability zones</button>
      )}
      {selected && (
        <>
          <h3>
            {selected.name} · {selected.year}
          </h3>
          {!drawing && (
            <p role="status">
              {!matchesBoundary
                ? 'Selected fire does not have a verified overlap with this boundary. Choose a matching fire or clear the boundary.'
                : selectedCoverage === null
                  ? 'Selected-fire coverage cannot be evaluated: its perimeter or applicability zones are missing.'
                  : `Selected fire: ${(selectedCoverage * 100).toFixed(1)}% supported coverage.`}
            </p>
          )}
          {selected.resultId && (
            <a href={precomputedHref(selected.resultId)}>Open precomputed result</a>
          )}
          <label>
            Observation summer
            <select
              value={chosenSummer ?? ''}
              disabled={!choices.length || processing}
              onChange={(event) => setSummer(event.target.value)}
            >
              <option value="" disabled>
                Select summer
              </option>
              {choices.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          {summers.state.status === 'loading' && <p role="status">Loading available summers…</p>}
          {summers.state.status === 'error' && (
            <div role="alert">
              <p>{summers.state.message}</p>
              <button onClick={summers.retry}>Retry summers</button>
            </div>
          )}
          {mock && (
            <label>
              <input
                type="checkbox"
                checked={failMock}
                onChange={(event) => setFailMock(event.target.checked)}
              />{' '}
              Simulate failure
            </label>
          )}
          <button disabled={!analysisEnabled} onClick={() => void analyze()}>
            {mock ? 'Run development simulation' : 'Check cache / request analysis'}
          </button>
          {processing && (
            <button
              onClick={() => {
                active.current?.abort();
                setBusy(false);
                setRun(null);
              }}
            >
              Cancel request
            </button>
          )}
        </>
      )}
      <div aria-live="polite">
        {visibleRun?.status === 'pending' && (
          <>
            <p>{visibleRun.step ?? 'Processing'} · this may take several minutes.</p>
            {visibleRun.progress !== undefined && <progress max={1} value={visibleRun.progress} />}
          </>
        )}
        {visibleRun?.status === 'failed' && (
          <p role="alert">
            {visibleRun.message ?? 'Analysis failed'} ({visibleRun.code})
          </p>
        )}
        {visibleRun?.status === 'complete' && (
          <>
            <p>
              {mock
                ? 'Development simulation complete. No scientific result was generated.'
                : 'Result ready.'}
            </p>
            {mock && selected?.resultId && (
              <a href={precomputedHref(selected.resultId)}>Open existing development fixture</a>
            )}
            {!mock && selected && (
              <button
                onClick={() =>
                  void onResult(visibleRun.result, selected.id).catch((failure: unknown) =>
                    setError(String(failure)),
                  )
                }
              >
                Open completed result
              </button>
            )}
          </>
        )}
      </div>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}

function chosenSummerKey(summer: string) {
  return summer || 'default';
}
