import { fireLabel } from '@/domain/fire/fireLabel';
import { mapHref } from '@/app/route';
import { FireGridMap } from '@/components/fire/FireGridMap';
import { ForecastYearBar } from '@/components/fire/ForecastYearBar';
import type { StudyMapController } from '@/components/map/StudyMapController';
import type { DemoFire } from '@/data/fireSchema';
import { fireFocusBounds, useFireCamera } from '@/hooks/useFireCamera';
import { useCatalogPerimeters } from '@/hooks/useCatalogPerimeters';
import { useApplicabilityZones } from '@/hooks/useApplicabilityZones';
import { ConfidenceZonesPanel } from '@/components/fire/ConfidenceZonesPanel';
import { EMPTY_FIRES, useFireCatalog } from '@/hooks/useFireCatalog';
import { type FireState } from '@/hooks/useFireData';
import { useFireInvestigation } from '@/hooks/useFireInvestigation';
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import type { CompositionProps } from '../types';
import { EarthHeader } from './EarthHeader';
import { FireInvestigation } from './FireInvestigation';
import { InvestigationPanel } from './InvestigationPanel';
import { PlanetView } from './PlanetView';
import { SourcesPanel } from './SourcesPanel';
import { FireSearch } from './FireSearch';
import { AnalysisClient } from '@/services/search/AnalysisClient';
import { config } from '@/config';
import type { FireData } from '@/data/fireSchema';
import searchStyles from './MapShell.module.css';
import { FireBottomBar } from './FireBottomBar';
import { FireSettingsPanel } from './FireSettingsPanel';
import { OtherFiresMenu } from './OtherFiresMenu';
import { Presence } from './Presence';
import { NO_CATALOG_FILTERS } from '@/domain/fire/catalogSearch';
import { useEarthView } from './useEarthView';
import { usePolygonDraft } from '@/hooks/usePolygonDraft';

const RegionView = lazy(() => import('./RegionView').then((m) => ({ default: m.RegionView })));
const AnalysisSections = lazy(() =>
  import('./AnalysisSections').then((m) => ({ default: m.AnalysisSections })),
);

/**
 * Earth Intelligence: planetary overview, then regional exploration.
 * Opens on a dotted globe of the real Earth with the study area located; the
 * primary action flies the (globe-projected) map from orbit into the region,
 * where analysis floats in thin-bordered panels over cool-graded imagery.
 *
 * Examples mode: catalogued fires are markers on the same map; the selected fire
 * (from the URL) is drawn on that map, never on a second one.
 */
export function EarthIntelligenceComposition({ load, study, mapView, mapState }: CompositionProps) {
  const view = useEarthView({ study, mapView, mapState });
  const [regionRequested, setRegionRequested] = useState(view.phase === 'region');
  if (!regionRequested && view.phase === 'region') setRegionRequested(true);
  const catalog = useFireCatalog();
  const applicability = useApplicabilityZones(view.phase === 'region');
  const fires = catalog.state.status === 'ready' ? catalog.state.data : EMPTY_FIRES;
  const examples = mapState.mode === 'examples';
  const polygonDraft = usePolygonDraft(
    !examples && mapState.draw === true && view.phase === 'region',
  );
  const selectedHeadingRef = useRef<HTMLHeadingElement>(null);
  const fireId = mapState.fireId;
  const fireOpen = fireId !== null;
  const perimeters = useCatalogPerimeters(
    examples && view.phase === 'region' ? mapView : null,
    fireId,
  );
  const [completed, setCompleted] = useState<FireData | null>(null);
  const resultRequest = useRef<AbortController | null>(null);
  useEffect(() => () => resultRequest.current?.abort(), [fireId, examples]);
  const investigation = useFireInvestigation(fireId, mapView, completed);
  const { data: fireData, fire, curve, forecastYear, pickYear } = investigation;
  const entry = fires.find((f) => f.id === fireId);
  // Examples with a fire open: Other fires top left, settings right, recovery bottom.
  const fireLayout = examples && fireOpen && view.phase === 'region';
  const previousFireLayout = useRef(false);
  useEffect(() => {
    if (previousFireLayout.current === fireLayout) return;
    previousFireLayout.current = fireLayout;
    (fireLayout ? selectedHeadingRef : view.regionHeadingRef).current?.focus({
      preventScroll: true,
    });
  }, [fireLayout, view.regionHeadingRef]);
  // Search and filters of the fire list, kept while the list moves between panels.
  const catalogFilters = useState(NO_CATALOG_FILTERS);
  const closeHref = mapHref({ ...mapState, presentation: 'explore', fireId: null });
  const cells = fireData?.bundle?.timeline
    ? {
        years: fireData.bundle.timeline.years,
        year: investigation.timelineYear,
        onYear: investigation.setTimelineYear,
      }
    : null;
  const fireBounds = fireData
    ? fireFocusBounds(fireData.result.fire.perimeter, fireData.result.map_grid)
    : null;
  const fitFire =
    mapView && fireBounds ? () => void mapView.focusBounds(fireBounds, { durationMs: 1200 }) : null;

  const selectFire = (target: DemoFire | string) => {
    const id = typeof target === 'string' ? target : target.id;
    window.location.hash = mapHref({ mode: 'examples', presentation: 'fire', fireId: id });
  };

  useFireMarkers(
    examples ? mapView : null,
    examples && view.phase === 'region' ? fires : null,
    fireId,
    selectFire,
  );
  useFireCamera({
    mapView,
    fireId: examples || completed?.result.fire.id === fireId ? fireId : null,
    presentation: mapState.presentation,
    bounds: fireBounds,
    failed: fire.status === 'error' || fire.status === 'absent',
    entry,
  });

  return (
    <>
      <p role="status" className="sr-only">
        {fireOpen ? fireStatus(fire, entry?.name.en ?? fireId) : view.status}
      </p>
      <EarthHeader view={view} />
      {perimeters.state.status === 'error' && (
        <div role="alert" className={searchStyles.mapLegend}>
          Catalog perimeters unavailable; fire locations and selection remain available.
          <button type="button" onClick={perimeters.retry}>
            Retry perimeters
          </button>
        </div>
      )}
      {view.sourcesOpen && <SourcesPanel study={study} onClose={view.closeSources} />}
      <PlanetView
        fires={fires}
        hidden={view.phase !== 'planet'}
        load={load}
        study={study}
        titleRef={view.titleRef}
        canEnter={view.canEnter}
        onEnter={view.enterRegion}
        sourcesOpen={view.sourcesOpen}
        onSources={view.toggleSources}
        onCloseSources={view.closeSources}
      />
      {regionRequested && (
        <Suspense fallback={null}>
          <RegionView hidden={view.phase !== 'region' || fireOpen} mapView={mapView} />
        </Suspense>
      )}
      {fireData && view.phase === 'region' && (
        <FireGridMap
          key={fireData.result.fire.id}
          mapView={mapView}
          data={fireData}
          layer={investigation.layer}
          overlays={investigation.overlays}
          opticalReady={investigation.optical === 'ready'}
          inspected={investigation.inspected}
          timelineYear={investigation.timelineYear}
          spatialLayer={investigation.spatialLayer}
          onInspect={investigation.inspect}
        />
      )}
      {curve && forecastYear !== null && view.phase === 'region' && !fireLayout && (
        <ForecastYearBar curve={curve} year={forecastYear} onYear={pickYear} cells={cells} />
      )}
      <Presence show={fireLayout} className={searchStyles.slideUp}>
        <FireBottomBar
          investigation={investigation}
          entry={entry}
          curve={curve}
          year={forecastYear}
          onYear={pickYear}
          cells={cells}
          onFit={fitFire}
          closeHref={closeHref}
        />
      </Presence>
      <Presence show={fireLayout} className={searchStyles.slideLeft}>
        <OtherFiresMenu href={closeHref} />
      </Presence>
      <Presence show={view.phase === 'region' && !fireLayout} className={searchStyles.slideRight}>
        <InvestigationPanel
          filters={catalogFilters}
          state={mapState}
          catalog={catalog}
          scientificContext={
            !fireLayout && <ConfidenceZonesPanel mapView={mapView} resource={applicability} />
          }
          onFireSelect={selectFire}
          onPlanet={view.goPlanet}
          headingRef={view.regionHeadingRef}
          search={
            <FireSearch
              draft={polygonDraft}
              applicability={applicability}
              catalog={catalog}
              state={mapState}
              mapView={mapView}
              onResult={async (url, selectedId) => {
                resultRequest.current?.abort();
                const request = new AbortController();
                resultRequest.current = request;
                const data = await new AnalysisClient(config.apiBaseUrl).result(
                  url,
                  request.signal,
                );
                if (data.result.fire.id !== selectedId)
                  throw new Error('Result does not match the selected fire.');
                if (!request.signal.aborted) setCompleted(data);
              }}
            />
          }
          fireDetail={
            fireId &&
            !examples &&
            (entry || completed?.result.fire.id === fireId) && (
              <FireInvestigation investigation={investigation} entry={entry} />
            )
          }
        >
          {study && !fireOpen && (
            <Suspense fallback={<p role="status">Loading study tools…</p>}>
              <AnalysisSections study={study} selection={view.selection} burn={view.burn} animate />
            </Suspense>
          )}
        </InvestigationPanel>
      </Presence>
      <Presence show={fireLayout} className={searchStyles.slideRight}>
        <FireSettingsPanel
          investigation={investigation}
          headingRef={selectedHeadingRef}
          zones={<ConfidenceZonesPanel mapView={mapView} resource={applicability} />}
        />
      </Presence>
    </>
  );
}

function fireStatus(state: FireState, name: string | null): string {
  switch (state.status) {
    case 'loading':
      return `Loading ${name}.`;
    case 'ready':
      return `${state.data.result.fire.name.en} ${state.data.result.fire.year} shown on the map.`;
    case 'absent':
      return `${name} is not in the example catalog.`;
    case 'error':
      return `${name} could not be loaded.`;
    default:
      return '';
  }
}

/** Catalogue fires as markers on the shared map (null hides them). */
function useFireMarkers(
  mapView: StudyMapController | null,
  fires: DemoFire[] | null,
  selectedId: string | null,
  onPick: (id: string) => void,
) {
  const pick = useRef(onPick);
  useEffect(() => {
    pick.current = onPick;
  });
  const markers = useMemo(
    () =>
      fires?.map((f) => ({
        id: f.id,
        label: fireLabel(f.id),
        lonlat: f.center_lonlat,
      })) ?? null,
    [fires],
  );
  useEffect(() => {
    if (!mapView || !markers) return;
    mapView.showFireMarkers(markers, selectedId, (id) => pick.current(id));
    return () => mapView.hideFireMarkers();
  }, [mapView, markers, selectedId]);
}
