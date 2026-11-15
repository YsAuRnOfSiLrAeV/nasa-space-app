import { useEffect, useRef, useState, type RefObject } from 'react';
import type { LocatedPoint } from '@/data/schema';
import type { BurnGroup } from '@/domain/study/burnGroups';
import type { CompositionProps } from '../types';
import { useEarthMap } from './useEarthMap';
import { mapHref } from '@/app/route';

export type Phase = 'planet' | 'region';

export interface SiteSelection {
  point: LocatedPoint | null;
  index: number;
  total: number;
  step: (delta: 1 | -1) => void;
}

/** The fire year picked in the burn register: highlighted on the map and in the point cloud. */
export interface BurnFocus {
  group: BurnGroup | null;
  locate: (group: BurnGroup) => void;
}

export interface EarthView {
  phase: Phase;
  /** Spoken description of the current view (the change never depends on seeing motion). */
  status: string;
  canEnter: boolean;
  enterRegion: () => void;
  goPlanet: () => void;
  sourcesOpen: boolean;
  toggleSources: () => void;
  closeSources: () => void;
  selection: SiteSelection;
  burn: BurnFocus;
  /** Focus targets: user-initiated view changes move focus into the new view. */
  titleRef: RefObject<HTMLHeadingElement | null>;
  regionHeadingRef: RefObject<HTMLHeadingElement | null>;
}

/** Nothing to step through until the study has loaded. */
const NO_SITES: LocatedPoint[] = [];

/**
 * Earth Intelligence's behaviour: the planet ↔ region phase, the flight from
 * orbit, focus management, site selection and the Sources panel. Presentation
 * components receive the result; they hold no state of their own.
 */
export function useEarthView({
  study,
  mapView,
  mapState,
}: Pick<CompositionProps, 'study' | 'mapView' | 'mapState'>) {
  const located = study?.located ?? NO_SITES;
  const phase: Phase = mapState.presentation === 'intro' ? 'planet' : 'region';
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [burnId, setBurnId] = useState<string | null>(null);
  /** False while the camera is still travelling into the region. */
  const [arrived, setArrived] = useState(true);
  const flyPending = useRef(false);
  /** Set by user-initiated view changes so focus follows them (not on first load). */
  const focusNext = useRef<Phase | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const regionHeadingRef = useRef<HTMLHeadingElement>(null);
  useEarthMap(mapView, selectedId, setSelectedId);

  // While the planet view covers the map, keep the map out of the tab order.
  useEffect(() => {
    mapView?.setInteractive(phase !== 'planet');
  }, [mapView, phase]);

  // Keyboard and screen-reader users land in the view they just opened.
  useEffect(() => {
    if (focusNext.current !== phase) return;
    focusNext.current = null;
    (phase === 'planet' ? titleRef : regionHeadingRef).current?.focus({ preventScroll: true });
  }, [phase]);

  // Fly from orbit once the region layout exists (its panels define the padding).
  useEffect(() => {
    if (phase !== 'region' || !flyPending.current || !mapView) return;
    flyPending.current = false;
    const id = requestAnimationFrame(() => {
      // Stop on the whole-Earth view with every fire; no fly-in to the Ontario test study.
      mapView.showWholeEarth();
      setArrived(true);
    });
    return () => cancelAnimationFrame(id);
  }, [phase, mapView]);

  const enterRegion = () => {
    flyPending.current = true;
    focusNext.current = 'region';
    setArrived(false);
    window.location.hash = mapHref({ ...mapState, presentation: 'explore', fireId: null });
  };

  const goPlanet = () => {
    focusNext.current = 'planet';
    mapView?.showWholeEarth();
    window.location.hash = mapHref({ ...mapState, presentation: 'intro', fireId: null });
  };

  const index = located.findIndex((p) => p.point_id === selectedId);
  const step = (delta: 1 | -1) => {
    const n = located.length;
    if (n === 0) return;
    const i = index < 0 ? (delta > 0 ? 0 : n - 1) : (index + delta + n) % n;
    const p = located[i]!;
    setSelectedId(p.point_id);
    if (phase === 'region') mapView?.focus([p.lon, p.lat], { minZoom: 8, durationMs: 900 });
  };

  const burnGroup = study?.burnGroups.find((g) => g.id === burnId) ?? null;
  const locateBurn = (g: BurnGroup) => {
    setBurnId(g.id);
    mapView?.focus(g.centroid, { minZoom: 9, durationMs: 1400 });
  };

  const status =
    phase === 'planet'
      ? 'Planet view: a dotted globe locates the study area. The map is hidden.'
      : !arrived
        ? 'Moving from the planet view to the study region.'
        : burnGroup
          ? `Map centred on the ${burnGroup.count} sample points burned in ${burnGroup.fireYear}, ${burnGroup.ageYears} years before the radar acquisitions.`
          : `Study region shown: map of ${located.length} sample points with the analysis panel.`;

  return {
    phase,
    status,
    canEnter: study !== null,
    enterRegion,
    goPlanet,
    sourcesOpen,
    toggleSources: () => setSourcesOpen((o) => !o),
    closeSources: () => setSourcesOpen(false),
    selection: {
      point: index >= 0 ? located[index]! : null,
      index,
      total: located.length,
      step,
    },
    burn: { group: burnGroup, locate: locateBurn },
    titleRef,
    regionHeadingRef,
  } satisfies EarthView;
}
