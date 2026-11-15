import { cn } from '@/lib/utils';
import { formatExtent } from '@/domain/globe/graticule';
import type { StudyMapController } from '@/components/map/StudyMapController';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import type { StudyView } from '../types';
import { BurnAnnotations } from './BurnAnnotations';
import { DottedGlobe } from './DottedGlobe';
import { Telemetry } from './Telemetry';
import { ViewportReadout } from './ViewportReadout';
import type { LandDots } from './useLandDots';
import type { BurnFocus } from './useEarthView';
import primitives from '@/components/shell/primitives.module.css';
import styles from './EarthIntelligence.module.css';

/**
 * Regional exploration (p12): the viewport readout, burn-scar annotations on the
 * map and, on wide screens, a bracketed stats footer with a locator globe back to
 * the planet. The analysis itself lives in the investigation panel.
 */
export function RegionView({
  hidden,
  study,
  land,
  burn,
  mapView,
  onPlanet,
}: {
  hidden: boolean;
  study: StudyView | null;
  land: LandDots;
  burn: BurnFocus;
  mapView: StudyMapController | null;
  onPlanet: () => void;
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
          dots={land.status === 'ready' ? land.data.dots : null}
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
