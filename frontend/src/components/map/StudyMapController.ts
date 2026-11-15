/**
 * The one place the app talks to MapLibre after the map is created.
 *
 * Compositions never touch the MapLibre instance. They receive this controller
 * and ask for intent: "focus this group", "show the study area", "use a globe",
 * "hide relief". Camera moves get the same padding (clear of the composition's
 * panels) and the same reduced-motion handling.
 */
import type {
  ExpressionSpecification,
  GeoJSONSource,
  ImageSource,
  LayerSpecification,
  LngLatBoundsLike,
  Map as MapLibreMap,
  MapLayerMouseEvent,
  MapMouseEvent,
  PaddingOptions,
  SourceSpecification,
} from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
import type { ApplicabilityLayer, ApplicabilityZones } from '@/data/applicabilityZones';
import {
  SOURCE_CONFIDENCE,
  CONFIDENCE_LAYERS,
  LAYER_CONFIDENCE_VERIFIED,
  LAYER_CONFIDENCE_EXTRAPOLATED,
  LAYER_CONFIDENCE_SOLID,
  LAYER_CONFIDENCE_DASHED,
} from './confidenceLayers';
import type { Manifest } from '@/data/schema';
import { LAYER_POINT_GLOW, LAYER_POINT_SELECTED, LAYER_POINTS, SOURCE_POINTS } from './layers';
import {
  FIRE_GRID_LAYERS,
  FIRE_GRID_SOURCES,
  LAYER_CATALOG_PERIMETERS,
  SOURCE_CATALOG_PERIMETERS,
  LAYER_FIRE_EXTENT,
  LAYER_FIRE_GEDI,
  LAYER_FIRE_GRID,
  LAYER_FIRE_HIGHLIGHT,
  LAYER_FIRE_MARKER_LABELS,
  LAYER_FIRE_MARKERS,
  LAYER_FIRE_OPTICAL,
  LAYER_FIRE_PERIMETER,
  LAYER_FIRE_PERIMETER_FILL,
  LAYER_FIRE_ZONE,
  LAYER_FIRE_ZONE_LINE,
  SOURCE_FIRE_EXTENT,
  SOURCE_FIRE_GEDI,
  SOURCE_FIRE_GRID,
  SOURCE_FIRE_HIGHLIGHT,
  SOURCE_FIRE_MARKERS,
  SOURCE_FIRE_OPTICAL,
  SOURCE_FIRE_PERIMETER,
  SOURCE_FIRE_ZONE,
  SOURCE_FIRE_ZONE_LINE,
  type Corners,
  type FireGridColors,
  type FireGridScene,
  type FireMarker,
  type FireOverlayVisibility,
  type FirePointer,
  type LngLat,
} from './fireLayers';

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
/**
 * MapLibre merges flyTo options over its defaults, so an explicit `curve: undefined`
 * replaces the default curve and the flight computes NaN positions. Omit it instead.
 */
const withCurve = (curve: number | undefined) => (curve === undefined ? {} : { curve });

const selectedFilter = (id: string | null): ExpressionSpecification => [
  '==',
  ['get', 'point_id'],
  id ?? '',
];

export class StudyMapController {
  private fireGridKind: 'fill' | 'raster' | null = null;
  /** The colour ramp the cell-value paint was last built for; null while cells show their own colours. */
  private cellRamp: string | null = null;
  private readonly map: MapLibreMap;
  private bbox: Manifest['bbox'];
  private readonly reducedMotion: () => boolean;
  private readonly padding: () => PaddingOptions;
  private readonly themeColor: (name: string, fallback: string) => string;
  private selectionClick: ((e: MapLayerMouseEvent) => void) | null = null;
  private markerClick: ((e: MapLayerMouseEvent) => void) | null = null;
  private confidenceData: ApplicabilityZones | null = null;
  private readonly markerEnter = () => (this.map.getCanvas().style.cursor = 'pointer');
  private readonly markerLeave = () => (this.map.getCanvas().style.cursor = '');

  constructor(config: StudyMapControllerConfig) {
    this.map = config.map;
    this.bbox = config.bbox;
    this.reducedMotion = config.reducedMotion;
    this.padding = config.padding;
    this.themeColor = config.themeColor;
  }

  /**
   * The study extent arrives independently of the map: the map starts on a fallback
   * extent so the example fires never wait for, or depend on, the study dataset.
   */
  setStudyBounds(bbox: Manifest['bbox']): void {
    this.bbox = bbox;
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

  /**
   * Centre on a place in the visible area, zooming in to at least `minZoom`.
   * The place is offset to the middle of the uncovered area. Not `padding`: MapLibre
   * keeps a flyTo padding on the map, and every later fit would then be padded twice.
   */
  focus(center: [number, number], { minZoom = 0, durationMs = 1200 } = {}): void {
    const pad = this.padding();
    this.map.flyTo({
      center,
      zoom: Math.max(this.map.getZoom(), minZoom),
      offset: [((pad.left ?? 0) - (pad.right ?? 0)) / 2, ((pad.top ?? 0) - (pad.bottom ?? 0)) / 2],
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
      this.map.flyTo({ ...camera, duration: this.duration(durationMs), ...withCurve(curve) });
    });
  }

  /**
   * Fly to fit [[west, south], [east, north]] into the visible area. Resolves when the
   * camera stops (immediately when the bounds cannot be fitted).
   */
  focusBounds(
    bounds: [[number, number], [number, number]],
    {
      durationMs = 2000,
      curve,
      maxZoom = 12,
    }: { durationMs?: number; curve?: number; maxZoom?: number } = {},
  ): Promise<void> {
    const camera = this.map.cameraForBounds(bounds, { padding: this.padding(), maxZoom });
    if (!camera) return Promise.resolve();
    return new Promise<void>((resolve) => {
      this.map.once('moveend', () => resolve());
      this.map.flyTo({
        ...camera,
        bearing: 0,
        pitch: 0,
        duration: this.duration(durationMs),
        ...withCurve(curve),
      });
    });
  }

  /** Jump (no animation) to a whole-Earth view centred on the study area. */
  showWholeEarth(): void {
    const [w, s, e, n] = this.bbox;
    this.map.jumpTo({ center: [(w + e) / 2, (s + n) / 2], zoom: 1.4, bearing: 0, pitch: 0 });
  }

  // ── Presentation set by the composition ───────────────────────────────────

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

  // ── Fires: catalogue markers and one selected fire's grid ─────────────────

  /** One marker per catalogued fire; the selected fire's marker is hidden under its grid. */
  showFireMarkers(markers: FireMarker[], selectedId: string | null, onPick: (id: string) => void) {
    const data: FeatureCollection = {
      type: 'FeatureCollection',
      features: markers.map((m) => ({
        type: 'Feature',
        properties: { id: m.id, label: m.label },
        geometry: { type: 'Point', coordinates: m.lonlat },
      })),
    };
    const source = this.map.getSource<GeoJSONSource>(SOURCE_FIRE_MARKERS);
    if (source) source.setData(data);
    else {
      this.map.addSource(SOURCE_FIRE_MARKERS, { type: 'geojson', data });
      const amber = this.themeColor('--amber', '#f7b755');
      const ground = this.themeColor('--map-background', '#060606');
      this.map.addLayer({
        id: LAYER_FIRE_MARKERS,
        type: 'circle',
        source: SOURCE_FIRE_MARKERS,
        paint: {
          'circle-color': amber,
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, 4, 8, 7],
          'circle-stroke-color': ground,
          'circle-stroke-width': 1.5,
        },
      });
      this.map.addLayer({
        id: LAYER_FIRE_MARKER_LABELS,
        type: 'symbol',
        source: SOURCE_FIRE_MARKERS,
        layout: {
          'text-field': ['get', 'label'],
          'text-font': ['Noto Sans Regular'],
          'text-size': 12,
          'text-offset': [0, 1.2],
          'text-anchor': 'top',
          'text-optional': true,
        },
        paint: { 'text-color': amber, 'text-halo-color': ground, 'text-halo-width': 1.5 },
      });
      this.map.on('mouseenter', LAYER_FIRE_MARKERS, this.markerEnter);
      this.map.on('mouseleave', LAYER_FIRE_MARKERS, this.markerLeave);
    }
    const filter: ExpressionSpecification = ['!=', ['get', 'id'], selectedId ?? ''];
    this.map.setFilter(LAYER_FIRE_MARKERS, filter);
    this.map.setFilter(LAYER_FIRE_MARKER_LABELS, filter);
    if (this.markerClick) this.map.off('click', LAYER_FIRE_MARKERS, this.markerClick);
    this.markerClick = (e) => {
      const id: unknown = e.features?.[0]?.properties?.id;
      if (typeof id === 'string') onPick(id);
    };
    this.map.on('click', LAYER_FIRE_MARKERS, this.markerClick);
  }

  showCatalogPerimeters(data: FeatureCollection, selectedId: string | null): void {
    const source = this.map.getSource<GeoJSONSource>(SOURCE_CATALOG_PERIMETERS);
    if (source) source.setData(data);
    else this.map.addSource(SOURCE_CATALOG_PERIMETERS, { type: 'geojson', data });
    if (!this.map.getLayer(LAYER_CATALOG_PERIMETERS))
      this.map.addLayer(
        {
          id: LAYER_CATALOG_PERIMETERS,
          type: 'line',
          source: SOURCE_CATALOG_PERIMETERS,
          paint: {
            'line-color': this.themeColor('--amber', '#f7b755'),
            'line-width': 1,
            'line-opacity': 0.55,
          },
        },
        this.map.getLayer(LAYER_FIRE_MARKERS) ? LAYER_FIRE_MARKERS : undefined,
      );
    this.map.setFilter(LAYER_CATALOG_PERIMETERS, ['!=', ['get', 'id'], selectedId ?? '']);
  }

  hideCatalogPerimeters(): void {
    this.removeLayers([LAYER_CATALOG_PERIMETERS], [SOURCE_CATALOG_PERIMETERS]);
  }

  hideFireMarkers(): void {
    if (this.markerClick) this.map.off('click', LAYER_FIRE_MARKERS, this.markerClick);
    this.markerClick = null;
    this.map.off('mouseenter', LAYER_FIRE_MARKERS, this.markerEnter);
    this.map.off('mouseleave', LAYER_FIRE_MARKERS, this.markerLeave);
    this.removeLayers([LAYER_FIRE_MARKER_LABELS, LAYER_FIRE_MARKERS], [SOURCE_FIRE_MARKERS]);
  }

  /**
   * Draw (or replace) the selected fire: categorical cell image stretched over the
   * grid's four corners, then overlays. Updates sources in place on later calls.
   */
  showFireGrid(scene: FireGridScene, colors: FireGridColors): void {
    const before = this.map.getLayer(LAYER_FIRE_MARKERS) ? LAYER_FIRE_MARKERS : undefined;
    // Keep the bottom-to-top order of FIRE_GRID_LAYERS even when a layer arrives late
    // (the optical image is added only once it has loaded): insert it under the next
    // fire layer that already exists, not on top of the grid, perimeter and GEDI points.
    const add = (layer: LayerSpecification) => {
      if (this.map.getLayer(layer.id)) return;
      const order: readonly string[] = FIRE_GRID_LAYERS;
      const above = order.slice(order.indexOf(layer.id) + 1).find((id) => this.map.getLayer(id));
      this.map.addLayer(layer, above ?? before);
    };
    const raster = (id: string, source: string, opacity: number): LayerSpecification => ({
      id,
      type: 'raster',
      source,
      paint: {
        'raster-opacity': opacity,
        'raster-resampling': 'nearest',
        'raster-fade-duration': 0,
      },
    });
    const image = (id: string, url: string | null, corners: Corners) => {
      const existing = this.map.getSource<ImageSource>(id);
      if (!url) return false;
      if (existing) existing.updateImage({ url, coordinates: corners });
      else this.map.addSource(id, { type: 'image', url, coordinates: corners });
      return true;
    };
    const geojson = (id: string, data: FeatureCollection, promoteId?: string) => {
      const existing = this.map.getSource<GeoJSONSource>(id);
      if (existing) existing.setData(data);
      else
        this.map.addSource(id, {
          type: 'geojson',
          data,
          ...(promoteId ? { promoteId } : {}),
        } satisfies SourceSpecification);
    };
    const { corners } = scene;

    if (image(SOURCE_FIRE_OPTICAL, scene.opticalImage, scene.opticalCorners ?? corners))
      add(raster(LAYER_FIRE_OPTICAL, SOURCE_FIRE_OPTICAL, 1));
    else this.removeLayers([LAYER_FIRE_OPTICAL], [SOURCE_FIRE_OPTICAL]);

    const expectedType = scene.cellGeometry ? 'fill' : 'raster';
    if (this.fireGridKind !== null && this.fireGridKind !== expectedType) {
      this.removeLayers([LAYER_FIRE_GRID], [SOURCE_FIRE_GRID]);
      this.cellRamp = null;
    }
    this.fireGridKind = expectedType;
    if (scene.cellGeometry) {
      // `i` is each cell's identity in every supplied file: it addresses the cell's feature state.
      geojson(SOURCE_FIRE_GRID, scene.cellGeometry, 'i');
      add({
        id: LAYER_FIRE_GRID,
        type: 'fill',
        source: SOURCE_FIRE_GRID,
        paint: {
          'fill-color': ['get', '_displayColor'],
          'fill-opacity': ['case', ['==', ['get', '_displayColor'], 'transparent'], 0, 0.8],
        },
      });
    } else {
      image(SOURCE_FIRE_GRID, scene.gridImage, corners);
      add(raster(LAYER_FIRE_GRID, SOURCE_FIRE_GRID, 0.88));
    }

    if (image(SOURCE_FIRE_ZONE, scene.zoneImage, corners))
      add(raster(LAYER_FIRE_ZONE, SOURCE_FIRE_ZONE, 1));
    else this.removeLayers([LAYER_FIRE_ZONE], [SOURCE_FIRE_ZONE]);

    geojson(SOURCE_FIRE_ZONE_LINE, {
      type: 'FeatureCollection',
      features: scene.zoneOutline.length
        ? [
            {
              type: 'Feature',
              properties: {},
              geometry: { type: 'MultiLineString', coordinates: scene.zoneOutline },
            },
          ]
        : [],
    });
    add({
      id: LAYER_FIRE_ZONE_LINE,
      type: 'line',
      source: SOURCE_FIRE_ZONE_LINE,
      paint: { 'line-color': colors.zone, 'line-width': 1.25, 'line-opacity': 0.9 },
    });

    geojson(SOURCE_FIRE_EXTENT, {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: [...corners, corners[0]] },
        },
      ],
    });
    add({
      id: LAYER_FIRE_EXTENT,
      type: 'line',
      source: SOURCE_FIRE_EXTENT,
      paint: { 'line-color': colors.extent, 'line-width': 1, 'line-dasharray': [3, 3] },
    });

    geojson(SOURCE_FIRE_PERIMETER, {
      type: 'FeatureCollection',
      features: scene.perimeter
        ? [{ type: 'Feature', properties: {}, geometry: scene.perimeter }]
        : [],
    });
    add({
      id: LAYER_FIRE_PERIMETER,
      type: 'line',
      source: SOURCE_FIRE_PERIMETER,
      paint: { 'line-color': colors.perimeter, 'line-width': 2.25 },
    });
    add({
      id: LAYER_FIRE_PERIMETER_FILL,
      type: 'fill',
      source: SOURCE_FIRE_PERIMETER,
      paint: { 'fill-color': colors.perimeter, 'fill-opacity': 0.035 },
    });

    geojson(SOURCE_FIRE_GEDI, {
      type: 'FeatureCollection',
      features: scene.gedi.map((coordinates, index) => ({
        type: 'Feature',
        properties: { index },
        geometry: { type: 'Point', coordinates },
      })),
    });
    add({
      id: LAYER_FIRE_GEDI,
      type: 'circle',
      source: SOURCE_FIRE_GEDI,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 3, 12, 6],
        'circle-color': colors.gediFill,
        'circle-stroke-color': colors.gediStroke,
        'circle-stroke-width': 2,
      },
    });
  }

  /** Outline one inspected cell (null clears it). Drawn above the grid, below GEDI points. */
  setFireHighlight(ring: LngLat[] | null, color: string): void {
    const data: FeatureCollection = {
      type: 'FeatureCollection',
      features: ring
        ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: ring } }]
        : [],
    };
    const source = this.map.getSource<GeoJSONSource>(SOURCE_FIRE_HIGHLIGHT);
    if (source) source.setData(data);
    else if (ring) {
      this.map.addSource(SOURCE_FIRE_HIGHLIGHT, { type: 'geojson', data });
      this.map.addLayer(
        {
          id: LAYER_FIRE_HIGHLIGHT,
          type: 'line',
          source: SOURCE_FIRE_HIGHLIGHT,
          paint: { 'line-color': color, 'line-width': 2.5 },
        },
        this.map.getLayer(LAYER_FIRE_GEDI) ? LAYER_FIRE_GEDI : undefined,
      );
    }
  }

  setFireOverlays(visible: FireOverlayVisibility): void {
    const show = (id: string, on: boolean) => {
      if (this.map.getLayer(id))
        this.map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
    };
    show(LAYER_FIRE_OPTICAL, visible.optical);
    show(LAYER_FIRE_ZONE, visible.zone);
    show(LAYER_FIRE_ZONE_LINE, visible.zone);
    show(LAYER_FIRE_PERIMETER, visible.perimeter);
    show(LAYER_FIRE_PERIMETER_FILL, visible.perimeter);
    show(LAYER_FIRE_GRID, visible.cells !== false);
    show(LAYER_FIRE_EXTENT, visible.cells !== false);
    show(LAYER_FIRE_HIGHLIGHT, visible.cells !== false);
    show(LAYER_FIRE_GEDI, visible.gedi);
  }

  /**
   * Recolour the supplied cells from one display value per cell (normalized 0–100, in the cells' own
   * order; null is a cell without a value), or return to the layer's colours with
   * `null`. The values travel as feature state: the polygons are neither re-sent nor
   * re-tiled, so stepping through years costs one repaint.
   */
  setFireCellValues(
    values: readonly (number | null)[] | null,
    [low, high]: readonly [string, string] = ['#3d6fa8', '#d6ecff'],
  ): void {
    if (this.fireGridKind !== 'fill' || !this.map.getLayer(LAYER_FIRE_GRID)) return;
    if (values === null) {
      if (this.cellRamp !== null) this.map.removeFeatureState({ source: SOURCE_FIRE_GRID });
      return;
    }
    const ramp = `${low} ${high}`;
    if (this.cellRamp !== ramp) {
      // State `v`: unset shows the layer's own colour, -1 is a missing value, 0+ a percentage.
      const value: ExpressionSpecification = ['coalesce', ['feature-state', 'v'], -2];
      this.map.setPaintProperty(LAYER_FIRE_GRID, 'fill-color', [
        'case',
        ['>=', value, 0],
        ['interpolate', ['linear'], value, 0, low, 100, high],
        ['to-color', ['get', '_displayColor']],
      ]);
      this.map.setPaintProperty(LAYER_FIRE_GRID, 'fill-opacity', [
        'case',
        ['>=', value, 0],
        0.8,
        ['==', value, -1],
        0,
        ['==', ['get', '_displayColor'], 'transparent'],
        0,
        0.8,
      ]);
      this.cellRamp = ramp;
    }
    values.forEach((cell, id) =>
      this.map.setFeatureState({ source: SOURCE_FIRE_GRID, id }, { v: cell ?? -1 }),
    );
  }

  clearFireGrid(): void {
    this.fireGridKind = null;
    this.cellRamp = null;
    this.removeLayers([...FIRE_GRID_LAYERS], [...FIRE_GRID_SOURCES]);
  }

  /** Pointer moves, clicks (taps) and exits over the map, with any GEDI footprint hit. */
  onFirePointer(listener: (event: FirePointer) => void): () => void {
    const gediAt = (e: MapMouseEvent): number | null => {
      if (!this.map.getLayer(LAYER_FIRE_GEDI)) return null;
      if (this.map.getLayoutProperty(LAYER_FIRE_GEDI, 'visibility') === 'none') return null;
      const hit = this.map.queryRenderedFeatures(e.point, { layers: [LAYER_FIRE_GEDI] })[0];
      const index: unknown = hit?.properties?.index;
      return typeof index === 'number' ? index : null;
    };
    const emit = (type: 'move' | 'click') => (e: MapMouseEvent) =>
      listener({
        ...(this.map.getLayer(LAYER_FIRE_PERIMETER_FILL) &&
        this.map.getLayoutProperty(LAYER_FIRE_PERIMETER_FILL, 'visibility') !== 'none' &&
        this.map.queryRenderedFeatures(e.point, { layers: [LAYER_FIRE_PERIMETER_FILL] }).length
          ? { perimeterHit: true }
          : {}),
        type,
        lngLat: [e.lngLat.lng, e.lngLat.lat],
        point: { x: e.point.x, y: e.point.y },
        gediIndex: gediAt(e),
      });
    const move = emit('move');
    const click = emit('click');
    const leave = () => listener({ type: 'leave', lngLat: null, point: null, gediIndex: null });
    const reset = () => listener({ type: 'reset', lngLat: null, point: null, gediIndex: null });
    this.map.on('mousemove', move);
    this.map.on('click', click);
    this.map.on('mouseout', leave);
    this.map.on('movestart', reset);
    return () => {
      this.map.off('mousemove', move);
      this.map.off('click', click);
      this.map.off('mouseout', leave);
      this.map.off('movestart', reset);
    };
  }

  private removeLayers(layers: string[], sources: string[]): void {
    for (const id of layers) if (this.map.getLayer(id)) this.map.removeLayer(id);
    for (const id of sources) if (this.map.getSource(id)) this.map.removeSource(id);
  }

  private disableSelectionClick(): void {
    if (this.selectionClick) this.map.off('click', LAYER_POINTS, this.selectionClick);
    this.selectionClick = null;
  }

  private duration(ms: number): number {
    return this.reducedMotion() ? 0 : ms;
  }

  showConfidenceZones(data: ApplicabilityZones, classification: ApplicabilityLayer): void {
    const source = this.map.getSource<GeoJSONSource>(SOURCE_CONFIDENCE);
    if (!source) this.map.addSource(SOURCE_CONFIDENCE, { type: 'geojson', data });
    else if (this.confidenceData !== data) source.setData(data);
    this.confidenceData = data;
    const before =
      FIRE_GRID_LAYERS.find((id) => this.map.getLayer(id)) ??
      (this.map.getLayer(LAYER_FIRE_MARKERS) ? LAYER_FIRE_MARKERS : undefined);
    const color: ExpressionSpecification = [
      'coalesce',
      ['get', 'color'],
      classification === 'model2_scenario' ? '#d4b87c' : '#6aa8dc',
    ];
    const layers: LayerSpecification[] = [
      {
        id: LAYER_CONFIDENCE_VERIFIED,
        type: 'fill',
        source: SOURCE_CONFIDENCE,
        paint: { 'fill-color': color, 'fill-opacity': ['coalesce', ['get', 'opacity'], 0.15] },
      },
      {
        id: LAYER_CONFIDENCE_EXTRAPOLATED,
        type: 'fill',
        source: SOURCE_CONFIDENCE,
        paint: { 'fill-color': color, 'fill-opacity': ['coalesce', ['get', 'opacity'], 0.05] },
      },
      {
        id: LAYER_CONFIDENCE_SOLID,
        type: 'line',
        source: SOURCE_CONFIDENCE,
        paint: { 'line-color': color, 'line-width': 1.2 },
      },
      {
        id: LAYER_CONFIDENCE_DASHED,
        type: 'line',
        source: SOURCE_CONFIDENCE,
        paint: { 'line-color': color, 'line-width': 1.2, 'line-dasharray': [3, 3] },
      },
    ];
    for (const layer of layers) {
      if (!this.map.getLayer(layer.id)) this.map.addLayer(layer, before);
      else
        this.map.setPaintProperty(
          layer.id,
          layer.type === 'fill' ? 'fill-color' : 'line-color',
          color,
        );
      const status =
        layer.id === LAYER_CONFIDENCE_EXTRAPOLATED || layer.id === LAYER_CONFIDENCE_DASHED
          ? 'extrapolated'
          : 'verified';
      this.map.setFilter(layer.id, [
        'all',
        ['==', ['get', 'layer'], classification],
        ['==', ['get', 'status'], status],
      ]);
    }
  }

  clearConfidenceZones(): void {
    this.removeLayers([...CONFIDENCE_LAYERS], [SOURCE_CONFIDENCE]);
    this.confidenceData = null;
  }

  showSearchGeometry(data: FeatureCollection, onPick: (id: string) => void): () => void {
    const source = 'search-geometry';
    const fill = 'search-geometry-fill';
    if (this.map.getSource(source)) (this.map.getSource(source) as GeoJSONSource).setData(data);
    else {
      this.map.addSource(source, { type: 'geojson', data });
      this.map.addLayer({
        id: source,
        type: 'line',
        source,
        paint: { 'line-color': '#d4b87c', 'line-width': 2 },
      });
    }
    if (!this.map.getLayer(fill))
      this.map.addLayer(
        {
          id: fill,
          type: 'fill',
          source,
          filter: ['has', 'fireId'],
          paint: { 'fill-color': '#d4b87c', 'fill-opacity': 0.035 },
        },
        source,
      );
    const click = (event: MapLayerMouseEvent) => {
      const id = event.features?.[0]?.properties?.fireId;
      if (typeof id === 'string') onPick(id);
    };
    this.map.on('click', source, click);
    this.map.on('click', fill, click);
    return () => {
      this.map.off('click', source, click);
      this.map.off('click', fill, click);
      this.removeLayers([fill, source], [source]);
    };
  }

  onDrawPoint(listener: (point: [number, number]) => void): () => void {
    const click = (event: MapMouseEvent) => listener([event.lngLat.lng, event.lngLat.lat]);
    this.map.on('click', click);
    this.map.getCanvas().style.cursor = 'crosshair';
    return () => {
      this.map.off('click', click);
      this.map.getCanvas().style.cursor = '';
    };
  }
}
