import { useEffect, useRef } from 'react';
import {
  Map as MapLibreMap,
  NavigationControl,
  ScaleControl,
  type GeoJSONSource,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './maplibreSetup';
import { config } from '@/config';
import type { Manifest, PointCollection } from '@/data/schema';
import { visiblePadding } from './camera';
// Map layer conventions: `<entity>-<role>`; sources are named after the entity.
import { LAYER_POINTS, SOURCE_POINTS, applyMapTheme, readMapTheme } from './mapTheme';
import { addLocalLand } from './localLand';
import { StudyMapController } from './StudyMapController';

interface StudyMapProps {
  points: PointCollection;
  bbox: Manifest['bbox'];
  /** Receives the map controller once the data layers exist (null on teardown). */
  onReady?: (view: StudyMapController | null) => void;
}

/**
 * Owns the MapLibre instance and its lifecycle. Created once; data updates are
 * applied to the existing map. Everything else (camera, projection, selection,
 * fire layers) goes through the StudyMapController it hands out.
 */
export function StudyMap({ points, bbox, onReady }: StudyMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  /** Set once our layers exist. (`isStyleLoaded()` is false while tiles load, so not usable here.) */
  const viewRef = useRef<StudyMapController | null>(null);
  const initial = useRef({ points, bbox });
  const onReadyRef = useRef(onReady);
  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const [w, s, e, n] = initial.current.bbox;

    const map = new MapLibreMap({
      container,
      style: config.basemapStyleUrl,
      bounds: [
        [w, s],
        [e, n],
      ],
      fitBoundsOptions: { padding: visiblePadding(container) },
      attributionControl: { compact: true },
      fadeDuration: reduceMotion ? 0 : 300,
    });
    mapRef.current = map;
    // Dev-only handle for debugging and automated visual checks.
    if (import.meta.env.DEV) (window as unknown as { __freMap?: MapLibreMap }).__freMap = map;

    map.addControl(new NavigationControl({ visualizePitch: false }), 'top-right');
    map.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-right');

    map.on('load', () => {
      addLocalLand(map);
      map.addSource(SOURCE_POINTS, { type: 'geojson', data: initial.current.points });

      // Burned points: filled. Unburned reference points: ring only.
      // Colors and size come from the theme (applyMapTheme below).
      map.addLayer({
        id: LAYER_POINTS,
        type: 'circle',
        source: SOURCE_POINTS,
        paint: {
          'circle-opacity': ['case', ['==', ['get', 'status'], 'burned'], 0.95, 0],
          'circle-stroke-width': ['case', ['==', ['get', 'status'], 'burned'], 0.75, 1.5],
        },
      });

      applyMapTheme(map, readMapTheme());
      // Compact attribution starts expanded; on narrow screens collapse it to the
      // ⓘ button (still one tap away) so it doesn't cover the small map.
      if (container.clientWidth < 640) {
        container
          .querySelector('.maplibregl-ctrl-attrib')
          ?.classList.remove('maplibregl-compact-show');
      }
      // Browser specifics are injected, so the controller itself stays DOM-free and testable.
      const view = new StudyMapController({
        map,
        bbox: initial.current.bbox,
        padding: () => visiblePadding(container),
        reducedMotion: () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        themeColor: (name, fallback) =>
          getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback,
      });
      viewRef.current = view;
      onReadyRef.current?.(view);
    });

    map.on('mouseenter', LAYER_POINTS, () => (map.getCanvas().style.cursor = 'pointer'));
    map.on('mouseleave', LAYER_POINTS, () => (map.getCanvas().style.cursor = ''));

    return () => {
      viewRef.current = null;
      onReadyRef.current?.(null);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Data updates without re-creating the map. The study may arrive after the map
  // (or never): points and extent are applied whenever they change.
  useEffect(() => {
    initial.current = { points, bbox };
    const source = mapRef.current?.getSource<GeoJSONSource>(SOURCE_POINTS);
    source?.setData(points);
    viewRef.current?.setStudyBounds(bbox);
  }, [points, bbox]);

  // Positioning lives on a wrapper: MapLibre's own (unlayered) CSS sets
  // `.maplibregl-map { position: relative }`, which beats Tailwind's layered
  // utilities and would collapse an `absolute inset-0` container to 0 px height.
  return (
    <div className="absolute inset-0">
      <div
        ref={containerRef}
        className="h-full w-full"
        role="region"
        aria-label="Study area map with GEDI sample points"
      />
    </div>
  );
}
