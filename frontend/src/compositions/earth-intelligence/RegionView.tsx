import type { RefObject } from 'react';
import { cn } from '@/lib/utils';
import { formatExtent } from '@/components/map/graticule';
import type { StudyMapController } from '@/components/map/StudyMapController';
import { HeightDistribution } from '@/components/visualizations/HeightDistribution';
import { SignalEvidence } from '@/components/visualizations/SignalEvidence';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { NumberedSection } from '@/components/shell/NumberedSection';
import { recoveryHref } from '@/app/route';
import { MapSidePanel } from '../MapSidePanel';
import type { StudyView } from '../types';
import { BurnAnnotations } from './BurnAnnotations';
import { BurnRegister } from './BurnRegister';
import { ForestPointCloud } from './ForestPointCloud';
import { DottedGlobe } from './DottedGlobe';
import { SiteReadout } from './SiteReadout';
import { Telemetry } from './Telemetry';
import { ViewportReadout } from './ViewportReadout';
import type { LandDots } from './useLandDots';
import type { BurnFocus, SiteSelection } from './useEarthView';
import primitives from '@/components/shell/primitives.module.css';
import styles from './EarthIntelligence.module.css';

/**
 * Regional exploration (p12): burn-scar annotations on the map, numbered
 * analysis floating over it (fire years, point cloud, height, signals, site),
 * and a bracketed stats footer with a locator globe back to the planet.
 */
export function RegionView({
  hidden,
  study,
  land,
  selection,
  burn,
  mapView,
  headingRef,
  onPlanet,
  onSources,
  showPanel = true,
}: {
  hidden: boolean;
  study: StudyView | null;
  land: LandDots;
  selection: SiteSelection;
  burn: BurnFocus;
  mapView: StudyMapController | null;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onPlanet: () => void;
  onSources: () => void;
  showPanel?: boolean;
}) {
  const wide = useMediaQuery('(min-width: 768px)');
  const fit = () => void mapView?.fitStudyArea();

  return (
    <div inert={hidden} className={cn(styles.region, hidden && styles.regionHidden)}>
      <RegionBackdrop />
      {!hidden && <ViewportReadout mapView={mapView} />}
      {study && !hidden && (
        <BurnAnnotations
          mapView={mapView}
          groups={study.burnGroups}
          focusId={burn.group?.id ?? null}
        />
      )}
      {showPanel && (
        <MapSidePanel
          label="Analysis"
          className={cn(
            styles.panel,
            'max-md:rounded-none max-md:border-x-0 max-md:border-b-0',
            'md:top-[76px] md:right-5 md:bottom-5 md:w-(--panel-width)',
          )}
          bodyClassName="space-y-(--section-gap) p-5"
        >
          <h2 ref={headingRef} tabIndex={-1} className="sr-only">
            Study region: map and analysis
          </h2>
          {study && !wide && (
            <PhoneRegionActions
              study={study}
              onPlanet={onPlanet}
              onFit={fit}
              onSources={onSources}
            />
          )}
          {study && (
            <AnalysisSections study={study} selection={selection} burn={burn} animate={!hidden} />
          )}
        </MapSidePanel>
      )}
      {study && wide && <RegionFooter study={study} land={land} onPlanet={onPlanet} onFit={fit} />}
    </div>
  );
}

/**
 * The theme's map overlay (none in this theme). No fades: the header and the
 * stats footer carry their own flat panels for legibility (project rule: no gradients).
 */
function RegionBackdrop() {
  return <div aria-hidden className="map-atmosphere" />;
}

export function AnalysisSections({
  study,
  selection,
  burn,
  animate,
}: {
  study: StudyView;
  selection: SiteSelection;
  burn: BurnFocus;
  animate: boolean;
}) {
  return (
    <>
      <NumberedSection n="01" title="Fire years" meta="MODIS MCD64A1">
        <BurnRegister
          groups={study.burnGroups}
          focusId={burn.group?.id ?? null}
          onLocate={burn.locate}
        />
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          Pick a year to fly to it. Groups of sampled points by fire year and 0.25° cell, not fire
          perimeters. Age is counted to the 2026 radar acquisitions.
        </p>
        {burn.group && (
          <a href={recoveryHref(burn.group.id)} className={cn(primitives.ghost, 'mt-3')}>
            Recovery evidence for {burn.group.label} <span aria-hidden>↗</span>
          </a>
        )}
      </NumberedSection>
      <NumberedSection n="02" title="Forest in 3D" meta="GEDI L2A · rh98">
        <ForestPointCloud located={study.located} focus={burn.group} animate={animate} />
      </NumberedSection>
      <NumberedSection n="03" title="Canopy height" meta="1 m bins">
        <HeightDistribution points={study.points} />
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          GEDI lidar observations in 1 m bins, not model predictions. Dashed lines mark the 5 m and
          10 m stage breaks.
        </p>
      </NumberedSection>
      <NumberedSection n="04" title="Signal response" meta="Spearman ρ">
        <SignalEvidence points={study.points} />
      </NumberedSection>
      <NumberedSection n="05" title="Site readout" meta="Select on map">
        <SiteReadout
          point={selection.point}
          index={selection.index}
          total={selection.total}
          onStep={selection.step}
        />
      </NumberedSection>
    </>
  );
}

/** Phones: the footer's stats and actions move into the top of the sheet. */
function PhoneRegionActions({
  study,
  onPlanet,
  onFit,
  onSources,
}: {
  study: StudyView;
  onPlanet: () => void;
  onFit: () => void;
  onSources: () => void;
}) {
  return (
    <>
      <Telemetry figures={study.figures} />
      <div className="flex flex-wrap gap-2">
        <button type="button" className={primitives.ghost} onClick={onPlanet}>
          Planet view
        </button>
        <button type="button" className={primitives.ghost} onClick={onFit}>
          Fit study area
        </button>
        <button type="button" className={primitives.ghost} onClick={onSources}>
          Sources
        </button>
      </div>
    </>
  );
}

/** Desktop: locator globe, bracketed stats, extent and acquisition dates, fit action. */
function RegionFooter({
  study,
  land,
  onPlanet,
  onFit,
}: {
  study: StudyView;
  land: LandDots;
  onPlanet: () => void;
  onFit: () => void;
}) {
  const { bbox, nisar_dates } = study.manifest;
  return (
    <footer
      data-map-occluder="bottom"
      className="absolute bottom-5 left-5 z-10 flex items-end gap-5 border border-rule-strong bg-(--panel-bg) py-3 pr-4 pl-3"
      style={{ right: 'calc(var(--panel-width) + 2.5rem)' }}
    >
      <button
        type="button"
        className={styles.mini}
        aria-label="Back to the planet view"
        onClick={onPlanet}
      >
        <DottedGlobe
          dots={land.status === 'ready' ? land.dots : null}
          bbox={bbox}
          label="Locator globe"
        />
      </button>
      <div className="min-w-0 space-y-2">
        <Telemetry figures={study.figures} />
        <div className={styles.ticks} aria-hidden />
        <p className={cn(primitives.micro, 'type-coord tracking-[0.08em]')}>
          Extent {formatExtent(bbox)} · NISAR acq {nisar_dates.join(' / ')}
        </p>
      </div>
      <button type="button" className={cn(primitives.ghost, 'mb-1 shrink-0')} onClick={onFit}>
        Fit study area
      </button>
    </footer>
  );
}
