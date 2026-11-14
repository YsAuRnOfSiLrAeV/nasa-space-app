/**
 * The one place the app talks to MapLibre after the map is created.
 *
 * Compositions never touch the MapLibre instance. They receive this controller
 * and ask for intent: "focus this group", "show the study area", "use a globe",
 * "hide relief". Camera moves get the same padding (clear of the composition's
 * panels) and the same reduced-motion handling in every theme.
 *
 * Theme overrides are undone centrally: `StudyMap` calls `resetThemeOverrides()`
 * on every theme switch, before the new theme is applied, so a composition never
 * has to clean up after itself.
 */
import type {
  ExpressionSpecification,
  LngLatBoundsLike,
  Map as MapLibreMap,
  MapLayerMouseEvent,
  PaddingOptions,
} from 'maplibre-gl';
import type { Manifest } from '@/data/schema';
import {
  LAYER_HILLSHADE,
  LAYER_POINT_GLOW,
  LAYER_POINT_SELECTED,
  LAYER_POINTS,
  SOURCE_POINTS,
} from './layers';

export type ToggleableLayer = 'relief' | 'points';
export type MapProjection = 'globe' | 'mercator';

/** Screen position in CSS px, relative to the map container. */
export interface ScreenPoint {
  x: number;
  y: number;
}

export interface ViewBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface StudyMapControllerConfig {
  map: MapLibreMap;
  /** Study extent [west, south, east, north]. */
  bbox: Manifest['bbox'];
  /** Live reduced-motion preference; camera moves become instant when true. */
  reducedMotion: () => boolean;
  /** Padding that keeps targets clear of whatever the active theme puts over the map. */
  padding: () => PaddingOptions;
  /** Theme colour lookup for layers the controller adds (CSS custom property name). */
  themeColor: (name: string, fallback: string) => string;
}

const LAYER_IDS: Record<ToggleableLayer, string> = {
  relief: LAYER_HILLSHADE,
  points: LAYER_POINTS,
};

const radius = (r5: number, r10: number, r14: number): ExpressionSpecification => [
  'interpolate',
  ['linear'],
  ['zoom'],
  5,
  r5,
  10,
  r10,
  14,
  r14,
];
const selectedFilter = (id: string | null): ExpressionSpecification => [
  '==',
  ['get', 'point_id'],
  id ?? '',
];

export class StudyMapController {
  private readonly map: MapLibreMap;
  private readonly bbox: Manifest['bbox'];
  private readonly reducedMotion: () => boolean;
  private readonly padding: () => PaddingOptions;
  private readonly themeColor: (name: string, fallback: string) => string;
  private selectionClick: ((e: MapLayerMouseEvent) => void) | null = null;

  constructor(config: StudyMapControllerConfig) {
    this.map = config.map;
    this.bbox = config.bbox;
    this.reducedMotion = config.reducedMotion;
    this.padding = config.padding;
    this.themeColor = config.themeColor;
  }

  // ── Reading the view (for overlays drawn on top of the map) ───────────────

  project(lngLat: [number, number]): ScreenPoint {
    const p = this.map.project(lngLat);
    return { x: p.x, y: p.y };
  }

  unproject(point: ScreenPoint): [number, number] {
    const l = this.map.unproject([point.x, point.y]);
    return [l.lng, l.lat];
  }

  bounds(): ViewBounds {
    const b = this.map.getBounds();
    return { west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() };
  }

  centre(): [number, number] {
    const c = this.map.getCenter();
    return [c.lng, c.lat];
  }

  zoom(): number {
    return this.map.getZoom();
  }

  /** Calls `listener` whenever the view moves or resizes. Returns an unsubscribe function. */
  onViewChange(listener: () => void): () => void {
    this.map.on('move', listener);
    this.map.on('resize', listener);
    return () => {
      this.map.off('move', listener);
      this.map.off('resize', listener);
    };
  }

  // ── Camera ────────────────────────────────────────────────────────────────

  /** Centre on a place in the visible area, zooming in to at least `minZoom`. */
  focus(center: [number, number], { minZoom = 0, durationMs = 1200 } = {}): void {
    this.map.flyTo({
      center,
      zoom: Math.max(this.map.getZoom(), minZoom),
      padding: this.padding(),
      duration: this.duration(durationMs),
    });
  }

  /** Fit the study extent into the visible area. Resolves when the camera stops. */
  fitStudyArea({ durationMs = 800, curve }: { durationMs?: number; curve?: number } = {}) {
    const [w, s, e, n] = this.bbox;
    const bounds: LngLatBoundsLike = [
      [w, s],
      [e, n],
    ];
    const camera = this.map.cameraForBounds(bounds, { padding: this.padding() });
    if (!camera) return Promise.resolve();
    return new Promise<void>((resolve) => {
      this.map.once('moveend', () => resolve());
      this.map.flyTo({ ...camera, duration: this.duration(durationMs), curve });
    });
  }

  /** Jump (no animation) to a whole-Earth view centred on the study area. */
  showWholeEarth(): void {
    const [w, s, e, n] = this.bbox;
    this.map.jumpTo({ center: [(w + e) / 2, (s + n) / 2], zoom: 1.4, bearing: 0, pitch: 0 });
  }

  // ── Theme presentation overrides (all undone by resetThemeOverrides) ──────

  setLayerVisible(layer: ToggleableLayer, visible: boolean): void {
    const id = LAYER_IDS[layer];
    if (this.map.getLayer(id)) {
      this.map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
    }
  }

  setProjection(type: MapProjection): void {
    this.map.setProjection({ type });
  }

  /** While a composition covers the map, keep it out of the tab order and pointer input. */
  setInteractive(interactive: boolean): void {
    this.map.getContainer().inert = !interactive;
  }

  /** A soft glow under the sample points, in the theme's accent colour. */
  showPointGlow(): void {
    if (this.map.getLayer(LAYER_POINT_GLOW)) return;
    this.map.addLayer(
      {
        id: LAYER_POINT_GLOW,
        type: 'circle',
        source: SOURCE_POINTS,
        paint: {
          'circle-color': this.themeColor('--forest', '#46aa80'),
          'circle-radius': radius(7, 13, 18),
          'circle-blur': 1,
          'circle-opacity': 0.32,
        },
      },
      LAYER_POINTS,
    );
  }

  /** Clicking a sample point reports its id; the selected point gets a ring. */
  enablePointSelection(onPick: (pointId: string) => void): void {
    if (!this.map.getLayer(LAYER_POINT_SELECTED)) {
      this.map.addLayer({
        id: LAYER_POINT_SELECTED,
        type: 'circle',
        source: SOURCE_POINTS,
        filter: selectedFilter(null),
        paint: {
          'circle-opacity': 0,
          'circle-radius': radius(7, 11, 15),
          'circle-stroke-color': this.themeColor('--foreground', '#ffffff'),
          'circle-stroke-width': 2,
        },
      });
    }
    this.disableSelectionClick();
    this.selectionClick = (e) => {
      const id: unknown = e.features?.[0]?.properties?.point_id;
      if (typeof id === 'string') onPick(id);
    };
    this.map.on('click', LAYER_POINTS, this.selectionClick);
  }

  setSelectedPoint(pointId: string | null): void {
    if (this.map.getLayer(LAYER_POINT_SELECTED)) {
      this.map.setFilter(LAYER_POINT_SELECTED, selectedFilter(pointId));
    }
  }

  /**
   * Back to the neutral map every theme starts from. Called by StudyMap on each
   * theme switch, before the new theme's colours are applied (which also decide
   * whether relief and imagery are shown).
   */
  resetThemeOverrides(): void {
    this.disableSelectionClick();
    for (const id of [LAYER_POINT_SELECTED, LAYER_POINT_GLOW]) {
      if (this.map.getLayer(id)) this.map.removeLayer(id);
    }
    this.setLayerVisible('points', true);
    this.setProjection('mercator');
    this.setInteractive(true);
  }

  private disableSelectionClick(): void {
    if (this.selectionClick) this.map.off('click', LAYER_POINTS, this.selectionClick);
    this.selectionClick = null;
  }

  private duration(ms: number): number {
    return this.reducedMotion() ? 0 : ms;
  }
}
