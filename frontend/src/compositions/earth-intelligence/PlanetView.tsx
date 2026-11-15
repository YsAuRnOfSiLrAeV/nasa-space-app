import type { DemoFire } from '@/data/fireSchema';
import { describeOrbits } from '@/data/missions';
import { formatExtent } from '@/domain/globe/graticule';
import { cn } from '@/lib/utils';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type RefObject,
} from 'react';
import { createLeaderLayout } from './planet/leaderLayout';
import type { StudyLoad, StudyView } from '../types';
import { ContourGround } from './ContourGround';
import styles from './EarthIntelligence.module.css';
import { GlobeLegend, LandingFooter, LandingLead } from './LandingOverlays';
import { ObservationSchematic } from './ObservationSchematic';
import { ObservationWindow } from './ObservationWindow';
import { PlanetHero, type GlobeAnchors, type GlobeStudy, type PointerRef } from './PlanetHero';
import cartography from './ScientificLanding.module.css';
import { useLandOutline } from './useLandOutline';

/** Where the camera looks when nothing has loaded yet: central Canada. */
const CANADA: [number, number] = [-100, 54];

/**
 * Landing, composed as one scientific plate around a central figure:
 *   centre  FIG. 01, the globe: Earth, the Ontario study, the fires.
 *   left    the lead: one finding and the one action, on the shared datum line.
 *   right   FIG. 01A, NISAR HV samples from the study region, joined to
 *           its true position on the globe by leader lines; FIG. 02, a labelled
 *           schematic of greenness versus structure.
 *   ground  charcoal technical paper with decorative contours.
 *   bottom  the figure index, with the legend and Sources.
 */
export function PlanetView({
  fires,
  hidden,
  load,
  study,
  titleRef,
  canEnter,
  onEnter,
  sourcesOpen,
  onSources,
  onCloseSources,
}: {
  fires: DemoFire[];
  hidden: boolean;
  load: StudyLoad;
  study: StudyView | null;
  titleRef: RefObject<HTMLHeadingElement | null>;
  canEnter: boolean;
  onEnter: () => void;
  sourcesOpen: boolean;
  onSources: () => void;
  onCloseSources: () => void;
}) {
  const pointer = useRef({ x: 0, y: 0 });
  const stageRef = useRef<HTMLElement>(null);
  const windowRef = useRef<HTMLDivElement>(null);
  const leaderRef = useRef<SVGPathElement>(null);
  const [layersOpen, setLayersOpen] = useState(false);
  const onLayersOpenChange = useCallback(
    (open: boolean) => {
      setLayersOpen(open);
      if (open && sourcesOpen) onCloseSources();
    },
    [onCloseSources, sourcesOpen],
  );
  const handleSources = useCallback(() => {
    setLayersOpen(false);
    onSources();
  }, [onSources]);
  // The first catalogued fire is named on the globe; every fire dot opens its page.
  const selectedFireId = fires[0]?.id ?? null;
  const footprints = study ? study.located.length : null;
  const site = study?.manifest.sites[0] ? titleCase(study.manifest.sites[0]) : null;

  const observed = study?.located.some((point) => Number.isFinite(point.nisar_hv_db))
    ? study
    : null;

  // Leader lines from the window's mark on the globe to the window, every frame
  // (the globe drifts). Hidden when the mark faces away or the window is not laid out.
  const lastAnchors = useRef<GlobeAnchors | null>(null);
  const [leaderLayout] = useState(createLeaderLayout);
  const placeLeaders = useCallback(
    (anchors: GlobeAnchors) => {
      lastAnchors.current = anchors;
      const { canvas, window: mark } = anchors;
      const path = leaderRef.current;
      const stage = stageRef.current;
      const frame = windowRef.current;
      if (!path) return;
      if (!stage || !frame) {
        path.setAttribute('d', '');
        return;
      }
      path.setAttribute('d', leaderLayout.path(mark, stage, canvas, frame));
    },
    [leaderLayout],
  );

  // A still globe paints rarely: re-place the leaders whenever the layout around
  // them settles (web fonts, the image arriving, resizes).
  useEffect(() => {
    // Next frame: by then the canvas has repainted for the new size as well.
    let raf = 0;
    const replace = () => {
      leaderLayout.invalidate();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (lastAnchors.current) placeLeaders(lastAnchors.current);
      });
    };
    const ro = new ResizeObserver(replace);
    if (stageRef.current) ro.observe(stageRef.current);
    const panel = windowRef.current?.parentElement;
    if (panel) ro.observe(panel);
    window.addEventListener('resize', replace);
    // The stage scales in and out (planet ↔ region). Rectangles read mid-transition
    // are scaled, so measure again once it has settled; a transform fires no resize.
    const stage = stageRef.current;
    const settled = (event: TransitionEvent | AnimationEvent) => {
      if (event.target === stage) replace();
    };
    stage?.addEventListener('transitionend', settled);
    stage?.addEventListener('animationend', settled);
    let live = true;
    document.fonts?.ready.then(() => live && replace());
    replace();
    return () => {
      live = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('resize', replace);
      stage?.removeEventListener('transitionend', settled);
      stage?.removeEventListener('animationend', settled);
    };
  }, [placeLeaders, observed, leaderLayout]);

  const track = (e: PointerEvent<HTMLElement>) => {
    if (e.pointerType !== 'mouse') return;
    const r = e.currentTarget.getBoundingClientRect();
    pointer.current = {
      x: ((e.clientX - r.left) / r.width) * 2 - 1,
      y: ((e.clientY - r.top) / r.height) * 2 - 1,
    };
  };

  return (
    <section
      ref={stageRef}
      aria-labelledby="ei-title"
      inert={hidden}
      onPointerMove={track}
      onPointerLeave={() => (pointer.current = { x: 0, y: 0 })}
      className={cn(
        styles.stage,
        cartography.surface,
        hidden && styles.stageHidden,
        'absolute inset-0 z-20 overflow-hidden',
      )}
    >
      <h1 id="ei-title" ref={titleRef} tabIndex={-1} className="sr-only">
        The Forest Remembers: explore forest recovery after historical fires
      </h1>
      <ContourGround className={cartography.ground} />
      <div aria-hidden="true" className={cartography.datum} />
      <GlobeStage
        fires={fires}
        selectedFireId={selectedFireId}
        study={study}
        site={site}
        footprints={footprints}
        pointer={pointer}
        animate={!hidden}
        observation={observed?.manifest.bbox ?? null}
        onAnchors={placeLeaders}
        onPlanetClick={canEnter ? onEnter : undefined}
        layersOpen={layersOpen}
        onLayersOpenChange={onLayersOpenChange}
      />
      <svg aria-hidden="true" className={cartography.leaders}>
        <path ref={leaderRef} />
      </svg>
      <LandingLead study={study} load={load} canEnter={canEnter} onEnter={onEnter} />
      <div className={cartography.annotations}>
        {observed && (
          <ObservationWindow study={observed} frameRef={windowRef} className={cartography.panel} />
        )}
        <ObservationSchematic className={cartography.panel} />
      </div>
      <LandingFooter
        footprints={footprints}
        site={site}
        layersOpen={layersOpen}
        onLayersOpenChange={onLayersOpenChange}
        sourcesOpen={sourcesOpen}
        onSources={handleSources}
      />
    </section>
  );
}

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * The globe in its own square canvas (only that area repaints), with its
 * description. Phones: smaller and higher, the lead beneath, the legend under it.
 */
function GlobeStage({
  fires,
  selectedFireId,
  study,
  site,
  footprints,
  pointer,
  animate,
  observation,
  onAnchors,
  onPlanetClick,
  layersOpen,
  onLayersOpenChange,
}: {
  fires: DemoFire[];
  selectedFireId: string | null;
  study: StudyView | null;
  site: string | null;
  footprints: number | null;
  pointer: PointerRef;
  animate: boolean;
  observation: readonly [number, number, number, number] | null;
  onAnchors: (anchors: GlobeAnchors) => void;
  onPlanetClick?: (() => void) | undefined;
  layersOpen: boolean;
  onLayersOpenChange: (open: boolean) => void;
}) {
  const { state: outline } = useLandOutline();
  const rings = outline.status === 'ready' ? outline.data : null;
  const globeStudy = useMemo<GlobeStudy | null>(
    () =>
      study
        ? {
            bbox: study.manifest.bbox,
            title: `STUDY REGION${site ? ` · ${site.toUpperCase()}` : ''}`,
            footprints: study.located,
          }
        : null,
    [study, site],
  );
  const target = useMemo(() => cameraTarget(study, fires), [study, fires]);
  const label = [
    'Globe of the Earth with land and coastlines, facing Canada.',
    study
      ? `In blue, the study region in ${site ?? 'Canada'} (${formatExtent(study.manifest.bbox)}) and its ${footprints} GEDI lidar footprints.`
      : '',
    observation
      ? 'An outlined region marks the extent of the NISAR HV sample plot shown beside the globe.'
      : '',
    `Around it, drawn spacecraft on illustrative orbits with real inclinations: ${describeOrbits()}.`,
    fires.length
      ? `In amber, ${fires.length} catalogued ${fires.length === 1 ? 'fire' : 'fires'} at their supplied coordinates; each marker opens the fire.`
      : '',
    'Orthographic projection. Meridians every 30 degrees and parallels every 20 degrees. Camera drift is for orientation only.',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <figure className={cartography.figure}>
      {outline.status === 'error' && (
        <p role="status" className="sr-only">
          The land outline could not be loaded. Study locations remain available.
        </p>
      )}
      <div className={cartography.figureLabel} aria-hidden="true">
        <span className={cartography.figureIndex}>FIG. 01 / GEOGRAPHIC CONTEXT</span>
        <span>{site ? `${site.toUpperCase()} / STUDY REGION` : 'CANADA'}</span>
      </div>
      <PlanetHero
        rings={rings}
        target={target}
        study={globeStudy}
        fires={fires}
        selectedFireId={selectedFireId}
        animate={animate}
        pointer={pointer}
        label={label}
        observation={observation}
        onAnchors={onAnchors}
        {...(onPlanetClick ? { onPlanetClick } : {})}
      />
      <figcaption className={cartography.figureCaption}>
        <span>Natural Earth 1:110m · orthographic</span>
        <span>Graticule 30° / 20°</span>
      </figcaption>
      <div className={cartography.legend}>
        <GlobeLegend
          footprints={footprints}
          site={site}
          open={layersOpen}
          onOpenChange={onLayersOpenChange}
        />
      </div>
    </figure>
  );
}

/** Between the study region and the catalogued fires, so all of them face the viewer. */
function cameraTarget(study: StudyView | null, fires: DemoFire[]): [number, number] {
  const places: [number, number][] = fires.map((f) => f.center_lonlat);
  if (study) {
    const [w, s, e, n] = study.manifest.bbox;
    places.push([(w + e) / 2, (s + n) / 2]);
  }
  if (!places.length) return CANADA;
  const lon = places.reduce((sum, p) => sum + p[0], 0) / places.length;
  const lat = places.reduce((sum, p) => sum + p[1], 0) / places.length;
  return [lon, lat];
}
