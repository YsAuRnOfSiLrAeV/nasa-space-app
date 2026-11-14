import { lazy, Suspense, useState } from 'react';
import type { CompositionProps } from '../types';
import { mapHref } from '@/app/route';
import { PageActiveContext, usePageActive } from '@/app/pageActive';
import type { DemoFire } from '@/data/fireSchema';
import { useFireCatalog } from '@/hooks/useFireCatalog';
import { EarthHeader } from './EarthHeader';
import { PlanetView } from './PlanetView';
import { RegionView, AnalysisSections } from './RegionView';
import { SourcesPanel } from './SourcesPanel';
import { useEarthView } from './useEarthView';
import { useLandDots } from './useLandDots';
import { InvestigationPanel } from './InvestigationPanel';
import shell from './MapShell.module.css';

const FirePage = lazy(() =>
  import('@/pages/fire/FirePage').then((module) => ({ default: module.FirePage })),
);

/**
 * Earth Intelligence: planetary overview, then regional exploration.
 * Opens on a dotted globe of the real Earth with the study area located; the
 * primary action flies the (globe-projected) map from orbit into the region,
 * where analysis floats in thin-bordered panels over cool-graded imagery.
 */
export function EarthIntelligenceComposition({ load, study, mapView, mapState }: CompositionProps) {
  const view = useEarthView({ study, mapView, mapState });
  const land = useLandDots();
  const pageActive = usePageActive();
  const catalog = useFireCatalog();
  // Keep the last result mounted and its camera intact when a workflow clears selection.
  // One result renderer only; another fire replaces its data, not a stack of maps.
  const [cachedFireId, setCachedFireId] = useState(mapState.fireId);
  if (mapState.fireId && mapState.fireId !== cachedFireId) setCachedFireId(mapState.fireId);
  const fireOpen = mapState.presentation === 'fire';
  const selectFire = (fire: DemoFire) => {
    mapView?.focus(fire.center_lonlat, { minZoom: 8 });
    window.location.hash = mapHref({ mode: 'examples', presentation: 'fire', fireId: fire.id });
  };

  return (
    <>
      <p role="status" className="sr-only">
        {view.status}
      </p>
      <EarthHeader view={view} />
      {view.sourcesOpen && <SourcesPanel study={study} onClose={view.closeSources} />}
      <PlanetView
        hidden={view.phase !== 'planet'}
        load={load}
        study={study}
        titleRef={view.titleRef}
        canEnter={view.canEnter}
        onEnter={view.enterRegion}
        sourcesOpen={view.sourcesOpen}
        onSources={view.toggleSources}
      />
      <RegionView
        hidden={view.phase !== 'region' || fireOpen}
        showPanel={false}
        study={study}
        land={land}
        selection={view.selection}
        burn={view.burn}
        mapView={mapView}
        headingRef={view.regionHeadingRef}
        onPlanet={view.goPlanet}
        onSources={view.toggleSources}
      />
      {cachedFireId && (
        <div className={shell.fireWorkspace} data-hidden={!fireOpen || undefined} inert={!fireOpen}>
          <Suspense fallback={<p role="status">Loading fire recovery…</p>}>
            <PageActiveContext value={pageActive && fireOpen}>
              <FirePage fireId={cachedFireId} embedded />
            </PageActiveContext>
          </Suspense>
        </div>
      )}
      {view.phase === 'region' && (
        <InvestigationPanel
          state={mapState}
          catalog={catalog}
          onFireSelect={selectFire}
          onPlanet={view.goPlanet}
          headingRef={view.regionHeadingRef}
        >
          {study && !fireOpen && (
            <AnalysisSections study={study} selection={view.selection} burn={view.burn} animate />
          )}
        </InvestigationPanel>
      )}
    </>
  );
}
