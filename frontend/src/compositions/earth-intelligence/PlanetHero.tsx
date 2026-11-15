import { useRef, type RefObject } from 'react';
import { fireHref } from '@/app/route';
import { config } from '@/config';
import type { DemoFire } from '@/data/fireSchema';
import styles from './PlanetHero.module.css';
import cartography from './ScientificLanding.module.css';
import { useCanvasRenderer } from '@/components/graphics/useCanvasRenderer';
import { drawAtmosphere, drawGraticule, drawLimb } from './planet/drawBody';
import { drawLandmasses } from './planet/drawEarth';
import { drawFootprints, drawObservationMark, type ScreenBox } from './planet/drawObservations';
import { drawSatellites } from './planet/drawSatellites';
import { drawStudyRegion } from './planet/drawStudyRegion';
import type { LandRing } from '../../domain/globe/landOutline';
import type { BBox } from './planet/region';
import { followPointer, planetFrame, readColors, type Pointer } from './planet/frame';

/** Pointer position over the stage, -1…1 on each axis (0 when not hovering). */
export type PointerRef = RefObject<Pointer>;

/** The study's forest observations, drawn at their true positions. */
export interface GlobeStudy {
  bbox: BBox;
  title: string;
  footprints: readonly { lon: number; lat: number }[];
}

/** Per-frame screen anchors for annotations outside the canvas (canvas pixels). */
export interface GlobeAnchors {
  canvas: HTMLCanvasElement;
  /** The observation window's extent on the globe; null when hidden or absent. */
  window: ScreenBox | null;
}

/**
 * Landing globe, in three layers, each one geography, an observation or an
 * interaction:
 *   1. Earth: dark ocean, Natural Earth 1:110m landmasses and coastline, grid.
 *   2. Forest observation (blue): the study region at its true extent and every
 *      GEDI footprint in it.
 *   3. Fire investigation (amber): one keyboard-reachable marker per catalogued
 *      fire at its supplied coordinates; the selected one is emphasised.
 * The camera faces the target and drifts a few degrees. Graticule, coastlines
 * and north-up reference marks provide orientation without illustrative tracks.
 */
export function PlanetHero({
  rings,
  target,
  study,
  fires,
  selectedFireId,
  animate,
  pointer,
  label,
  observation = null,
  onAnchors,
}: {
  /** Extent of the observation window's imagery, marked on the globe. */
  observation?: BBox | null;
  /** Called after every paint with the screen anchors (for leader lines). */
  onAnchors?: (anchors: GlobeAnchors) => void;
  rings: LandRing[] | null;
  /** [lon, lat] the camera faces. */
  target: [number, number];
  study: GlobeStudy | null;
  fires: DemoFire[];
  selectedFireId: string | null;
  animate: boolean;
  pointer: PointerRef;
  label: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const smooth = useRef<Pointer>({ x: 0, y: 0 });
  const markers = useRef(new Map<string, HTMLAnchorElement>());
  const focused = useRef(false);
  const pausedAt = useRef<number | null>(null);

  useCanvasRenderer(
    ref,
    (canvas) => {
      const el = ref.current;
      if (!el) return;
      // A focused fire marker holds the globe still, so it does not move under the focus ring.
      if (!focused.current) pausedAt.current = null;
      if (focused.current && pausedAt.current == null) pausedAt.current = canvas.t;
      const sway = focused.current
        ? smooth.current
        : followPointer(smooth.current, pointer.current, canvas.still);
      const f = planetFrame(
        { ...canvas, t: pausedAt.current ?? canvas.t },
        { target, sway, colors: readColors(el) },
      );

      // 1. Earth
      drawAtmosphere(f);
      drawLandmasses(f, rings);
      drawGraticule(f);
      drawLimb(f);
      // 2. Forest observation
      if (study) {
        drawFootprints(f, study.footprints);
        // Named outside the silhouette by the landing's annotations, not on the sphere.
        drawStudyRegion(f, study.bbox, study.title, { label: !onAnchors });
      }
      const windowBox = observation ? drawObservationMark(f, observation) : null;
      // 4. The missions that observe it, on their orbits (positions illustrative).
      drawSatellites(f);
      onAnchors?.({ canvas: el, window: windowBox });
      // 3. Fire investigation: DOM anchors follow the exact canvas projection
      // (resize, reduced motion, and hidden on the back of the globe).
      for (const fire of fires) {
        const position = f.project(...fire.center_lonlat);
        const marker = markers.current.get(fire.id);
        if (!marker) continue;
        marker.style.transform = `translate3d(${position.x}px, ${position.y}px, 0) translate(-50%, -50%)`;
        marker.style.visibility = position.z > 0.05 ? 'visible' : 'hidden';
      }
    },
    {
      animate,
      deps: [rings, target[0], target[1], study, fires, observation],
    },
  );

  return (
    <div className={`relative h-full w-full ${cartography.globeInstruments}`}>
      <canvas ref={ref} role="img" aria-label={label} className="block h-full w-full" />
      {fires.map((fire) => (
        <a
          key={fire.id}
          ref={(el) => {
            if (el) markers.current.set(fire.id, el);
            else markers.current.delete(fire.id);
          }}
          href={fireHref(fire.id)}
          className={styles.globeMarker}
          data-selected={fire.id === selectedFireId || undefined}
          data-example={config.fireDataIsExample || undefined}
          style={{ visibility: 'hidden' }}
          aria-label={`Open ${fire.name.en}, fire of ${fire.year}${config.fireDataIsExample ? ' (documentation example data)' : ''}`}
          onFocus={() => {
            focused.current = true;
          }}
          onBlur={() => {
            focused.current = false;
          }}
        >
          <span aria-hidden className={styles.globeMarkerDot} />
          <span className={styles.globeMarkerLabel}>
            {fire.name.en} · {fire.year}
            {config.fireDataIsExample && <small> · example</small>}
          </span>
        </a>
      ))}
    </div>
  );
}
