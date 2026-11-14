import { useCallback, useEffect, useMemo, useRef, type PointerEvent, type RefObject } from 'react';
import { cn } from '@/lib/utils';
import { formatExtent } from '@/components/map/graticule';
import { describeOrbits } from '@/data/missions';
import { useFireCatalog } from '@/hooks/useFireCatalog';
import { useRecoveryData } from '@/hooks/useRecoveryData';
import type { DemoFire } from '@/data/fireSchema';
import type { RecoveryFile, RecoveryImage } from '@/data/recoverySchema';
import type { StudyLoad, StudyView } from '../types';
import { ContourGround } from './ContourGround';
import { GlobeLegend, LandingFooter, LandingLead } from './LandingOverlays';
import { ObservationSchematic } from './ObservationSchematic';
import { ObservationWindow } from './ObservationWindow';
import { latestImage } from './planet/observationWindow';
import { PlanetHero, type GlobeAnchors, type GlobeStudy, type PointerRef } from './PlanetHero';
import { useLandOutline } from './useLandOutline';
import styles from './EarthIntelligence.module.css';
import cartography from './ScientificLanding.module.css';

/** Where the camera looks when nothing has loaded yet: central Canada. */
const CANADA: [number, number] = [-100, 54];

/**
 * The Ontario burn whose Landsat scenes fill the observation window (the one
 * burn-scar group with rendered imagery; `npm run data:landsat`). If its record
 * is absent the window and its mark on the globe are simply not drawn.
 */
const OBSERVATION_GROUP = '2002_205_-376';

/**
 * Landing, composed as one scientific plate around a central figure:
 *   centre  FIG. 01, the globe: Earth, the Ontario study, the fires.
 *   left    the lead: one finding and the one action, on the shared datum line.
 *   right   FIG. 01A, a real Landsat observation of an Ontario burn, joined to
 *           its true position on the globe by leader lines; FIG. 02, a labelled
 *           schematic of greenness versus structure.
 *   ground  charcoal technical paper with decorative contours.
 *   bottom  the figure index, with the legend and Sources.
 */
export function PlanetView({
  hidden,
  load,
  study,
  titleRef,
  canEnter,
  onEnter,
  sourcesOpen,
  onSources,
}: {
  hidden: boolean;
  load: StudyLoad;
  study: StudyView | null;
  titleRef: RefObject<HTMLHeadingElement | null>;
  canEnter: boolean;
  onEnter: () => void;
  sourcesOpen: boolean;
  onSources: () => void;
}) {
  const pointer = useRef({ x: 0, y: 0 });
  const stageRef = useRef<HTMLElement>(null);
  const windowRef = useRef<HTMLDivElement>(null);
  const leaderRef = useRef<SVGPathElement>(null);
  const catalog = useFireCatalog();
  // The first catalogued fire is named on the globe; every fire dot opens its page.
  const selectedFireId = catalog.fires[0]?.id ?? null;
  const footprints = study ? study.located.length : null;
  const site = study?.manifest.sites[0] ? titleCase(study.manifest.sites[0]) : null;

  const recovery = useRecoveryData(OBSERVATION_GROUP);
  const observed = useMemo<{ record: RecoveryFile; image: RecoveryImage } | null>(() => {
    if (recovery.status !== 'ready') return null;
    const image = latestImage(recovery.data);
    return image ? { record: recovery.data, image } : null;
  }, [recovery]);

  // Leader lines from the window's mark on the globe to the window, every frame
  // (the globe drifts). Hidden when the mark faces away or the window is not laid out.
  const lastAnchors = useRef<GlobeAnchors | null>(null);
  const placeLeaders = useCallback((anchors: GlobeAnchors) => {
    lastAnchors.current = anchors;
    const { canvas, window: mark } = anchors;
    const path = leaderRef.current;
    const stage = stageRef.current;
    const frame = windowRef.current;
    if (!path) return;
    const shown = frame?.offsetParent != null;
    if (!mark || !stage || !frame || !shown) {
      path.setAttribute('d', '');
      return;
    }
    const s = stage.getBoundingClientRect();
    const c = canvas.getBoundingClientRect();
    const f = frame.getBoundingClientRect();
    const ox = c.left - s.left;
    const oy = c.top - s.top;
    const fx = f.left - s.left;
    const fy = f.top - s.top;
    path.setAttribute(
      'd',
      `M${ox + mark.x1} ${oy + mark.y0}L${fx} ${fy}` +
        `M${ox + mark.x1} ${oy + mark.y1}L${fx} ${fy + f.height}`,
    );
  }, []);

  // A still globe paints rarely: re-place the leaders whenever the layout around
  // them settles (web fonts, the image arriving, resizes).
  useEffect(() => {
    // Next frame: by then the canvas has repainted for the new size as well.
    let raf = 0;
    const replace = () => {
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
    let live = true;
    document.fonts?.ready.then(() => live && replace());
    return () => {
      live = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('resize', replace);
    };
  }, [placeLeaders, observed]);

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
        The Forest Remembers: explore forest recovery after Canadian fires
      </h1>
      <ContourGround className={cartography.ground} />
      <div aria-hidden="true" className={cartography.datum} />
      <GlobeStage
        fires={catalog.fires}
        selectedFireId={selectedFireId}
        study={study}
        site={site}
        footprints={footprints}
        pointer={pointer}
        animate={!hidden}
        observation={observed?.record.bbox ?? null}
        onAnchors={placeLeaders}
      />
      <svg aria-hidden="true" className={cartography.leaders}>
        <path ref={leaderRef} />
      </svg>
      <LandingLead study={study} load={load} canEnter={canEnter} onEnter={onEnter} />
      <div className={cartography.annotations}>
        {observed && (
          <ObservationWindow
            record={observed.record}
            image={observed.image}
            imageRef={windowRef}
            className={cartography.panel}
          />
        )}
        <ObservationSchematic className={cartography.panel} />
      </div>
      <LandingFooter
        footprints={footprints}
        site={site}
        sourcesOpen={sourcesOpen}
        onSources={onSources}
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
}) {
  const rings = useLandOutline();
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
      ? 'A small outlined square marks the extent of the Landsat observation shown beside the globe.'
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
      />
      <figcaption className={cartography.figureCaption}>
        <span>Natural Earth 1:110m · orthographic</span>
        <span>Graticule 30° / 20°</span>
      </figcaption>
      <div className={cartography.legend}>
        <GlobeLegend footprints={footprints} site={site} />
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
