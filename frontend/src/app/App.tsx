import { Suspense, lazy, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { cn } from '@/lib/utils';
import type { StudyMapController } from '@/components/map/StudyMapController';
import { buildStudyView } from '@/domain/study/studyView';
import type { Manifest, PointCollection } from '@/data/schema';
import { EarthIntelligenceComposition } from '@/compositions/earth-intelligence/EarthIntelligenceComposition';
import type { StudyLoad, StudyView } from '@/domain/study/studyView';
import { PageLoading } from '@/components/shell/PageLayout';
import { useHashRoute } from '@/hooks/useHashRoute';
import { INITIAL_MAP_STATE, mapHref, mapStateOf, type Route } from './route';
import { MapNavigationContext } from './mapNavigation';
import { useOccludedInsets } from '@/hooks/useOccludedInsets';
import { useStudyData } from '@/hooks/useStudyData';
import { PageActiveContext } from './pageActive';

/** Loaded on first visit: the explorer does not pay for the Research and Recovery pages' code. */
const ResearchPage = lazy(() =>
  import('@/pages/research/ResearchPage').then((m) => ({ default: m.ResearchPage })),
);
const RecoveryPage = lazy(() =>
  import('@/pages/recovery/RecoveryPage').then((m) => ({ default: m.RecoveryPage })),
);
/** Three.js lives only in this chunk: nothing else pays for it. */
const Forest3DPage = lazy(() =>
  import('@/pages/forest3d/Forest3DPage').then((m) => ({ default: m.Forest3DPage })),
);
/** The landing is a canvas globe; load the WebGL map only when its workspace opens. */
const StudyMap = lazy(() =>
  import('@/components/map/StudyMap').then((m) => ({ default: m.StudyMap })),
);

/** Until (or unless) the Ontario study loads: no sample points, a Canada-wide extent. */
const NO_POINTS: PointCollection = { type: 'FeatureCollection', features: [] };
const CANADA_BBOX: Manifest['bbox'] = [-141, 41.7, -52.6, 70];

/**
 * Owns all behaviour (data, map controller, route) once. The explorer (the
 * Earth Intelligence composition over the map) is always mounted; every other
 * page (see `route.ts`) opens over it, so returning keeps the view, the picked
 * fire year and the camera.
 */
export function App() {
  const { retry, state } = useStudyData();
  const route = useHashRoute();
  const currentMap = mapStateOf(route);
  const [lastMap, setLastMap] = useState(currentMap ?? INITIAL_MAP_STATE);
  if (currentMap && mapHref(currentMap) !== mapHref(lastMap)) setLastMap(currentMap);
  const mapState = currentMap ?? lastMap;
  const [mapView, setMapView] = useState<StudyMapController | null>(null);
  const scopeRef = useRef<HTMLElement>(null);

  const data = state.status === 'ready' ? state.data : null;
  const study = useMemo(() => (data ? buildStudyView(data) : null), [data]);
  const load: StudyLoad =
    state.status === 'error'
      ? { status: 'error', message: state.message, retry }
      : { status: state.status === 'ready' ? 'ready' : 'loading' };
  const covered = currentMap === null;
  const [mapRequested, setMapRequested] = useState(
    () => currentMap !== null && currentMap.presentation !== 'intro',
  );
  // Once opened, keep this same map mounted across mode and page changes.
  if (!mapRequested && currentMap && currentMap.presentation !== 'intro') setMapRequested(true);

  useOccludedInsets(scopeRef, [state.status, covered, mapState.presentation, mapState.mode]);
  useExplorerFocusReturn(scopeRef, covered);

  return (
    <MapNavigationContext value={mapState}>
      {/* Covered, not removed: visibility keeps every size (map, charts) intact for the return. */}
      <main
        ref={scopeRef}
        data-map-scope
        inert={covered}
        className={cn(
          'relative h-full overflow-hidden bg-(image:--app-backdrop)',
          covered && 'invisible',
        )}
      >
        <PageActiveContext value={!covered}>
          {/* The one map instance: example fires are drawn on it, not on a map of their own. */}
          <div className="absolute inset-0">
            {/* Mounted whatever the study data does: the example fires must not depend on it. */}
            {mapRequested && (
              <Suspense
                fallback={
                  <p
                    role="status"
                    className="absolute inset-x-0 top-1/2 text-center text-sm text-muted-foreground"
                  >
                    Loading interactive map…
                  </p>
                }
              >
                <StudyMap
                  // The Ontario sample points were a test dataset for the first frontend format: not drawn.
                  points={NO_POINTS}
                  bbox={data?.manifest.bbox ?? CANADA_BBOX}
                  onReady={setMapView}
                />
              </Suspense>
            )}
          </div>
          <EarthIntelligenceComposition
            load={load}
            study={study}
            mapView={mapView}
            mapState={mapState}
          />
        </PageActiveContext>
      </main>
      <Suspense fallback={<PageLoading label={loadingLabel(route)} />}>
        <CoveringPage route={route} load={load} study={study} />
      </Suspense>
    </MapNavigationContext>
  );
}

/** What the first visit to a lazily loaded page is waiting for, in the reader's words. */
function loadingLabel(route: Route): string {
  switch (route.page) {
    case 'research':
      return 'Loading the research page';
    case 'recovery':
      return 'Loading the burn-group evidence';
    case 'forest3d':
      return 'Loading the 3D forest';
    default:
      return 'Loading page';
  }
}

/** The page that opens over the explorer for a route, or nothing on the explorer itself. */
function CoveringPage({
  route,
  load,
  study,
}: {
  route: Route;
  load: StudyLoad;
  study: StudyView | null;
}) {
  switch (route.page) {
    case 'explore':
      return null;
    case 'fire':
    case 'analyze':
      return null; // Legacy Map addresses are resolved by mapStateOf.
    case 'research':
      return <ResearchPage load={load} study={study} />;
    case 'recovery':
      return <RecoveryPage load={load} study={study} groupId={route.groupId} view={route.view} />;
    case 'forest3d':
      return <Forest3DPage />;
  }
}

/**
 * Coming back from another page puts keyboard focus where it was in the explorer
 * (usually the link that opened the page) instead of on the document body.
 */
function useExplorerFocusReturn(scopeRef: RefObject<HTMLElement | null>, covered: boolean) {
  const last = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const el = scopeRef.current;
    if (!el) return;
    const remember = (e: FocusEvent) => {
      if (e.target instanceof HTMLElement) last.current = e.target;
    };
    el.addEventListener('focusin', remember);
    return () => el.removeEventListener('focusin', remember);
  }, [scopeRef]);
  useEffect(() => {
    if (covered) return;
    const target = last.current;
    if (target?.isConnected) target.focus({ preventScroll: true });
  }, [covered]);
}
