import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Map as MapLibreMap,
  NavigationControl,
  ScaleControl,
  type ExpressionSpecification,
  type FilterSpecification,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import '@/components/map/maplibreSetup';
import { applyMapTheme, readMapTheme } from '@/components/map/mapTheme';
import { config } from '@/config';
import type { FireData } from '@/data/fireSchema';
import type { CanadianContext } from '@/data/contextSchema';
import type { GeoJSONSource } from 'maplibre-gl';
import { useTheme } from '@/theme/theme-context';
import { fireGridFeatures } from './fireSpatial';
import styles from './Fire.module.css';

export type FireLayer = 'stage' | 'recovery' | 'ndvi' | 'confidence';

function cellColor(layer: FireLayer): ExpressionSpecification {
  const theme = readMapTheme();
  const [low, middle, high] = theme.stages;
  const value: ExpressionSpecification = ['get', layer];
  const ramp: ExpressionSpecification =
    layer === 'stage' || layer === 'confidence'
      ? ['match', value, 0, low, 1, middle, 2, high, theme.background]
      : [
          'interpolate',
          ['linear'],
          ['coalesce', value, 0],
          0,
          low,
          layer === 'ndvi' ? 0.5 : 50,
          middle,
          layer === 'ndvi' ? 1 : 100,
          high,
        ];
  return ['case', ['==', value, null], 'rgba(0,0,0,0)', ramp];
}

/** The same result powers the map and the keyboard-accessible cell readout. */
export function FireMap({
  data,
  layer,
  showLidar,
  selectedCell,
  onSelect,
  context,
  showWater,
}: {
  data: FireData;
  layer: FireLayer;
  showLidar: boolean;
  selectedCell: number | null;
  onSelect: (index: number) => void;
  context: CanadianContext | null;
  showWater: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const { themeId } = useTheme();
  const features = useMemo(() => fireGridFeatures(data), [data]);
  const { result } = data;
  const [status, setStatus] = useState('Loading the spatial map…');
  const [ready, setReady] = useState(false);
  // The map lifecycle follows the loaded result. Layer, theme and selection
  // updates below change existing layers without recreating the map.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let map: MapLibreMap;
    const corners = result.map_grid.corners_lonlat;
    const bounds: [[number, number], [number, number]] = [
      [Math.min(...corners.map(([lon]) => lon)), Math.min(...corners.map(([, lat]) => lat))],
      [Math.max(...corners.map(([lon]) => lon)), Math.max(...corners.map(([, lat]) => lat))],
    ];
    try {
      map = new MapLibreMap({
        container: host,
        style: config.basemapStyleUrl,
        bounds,
        fitBoundsOptions: { padding: 35 },
        attributionControl: { compact: true },
      });
    } catch {
      // WebGL construction can fail before there is a map to emit error events.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus('The map could not start. Cell values and fire details are available below.');
      return;
    }
    mapRef.current = map;
    const select = (event: { features?: { properties?: Record<string, unknown> | null }[] }) => {
      const index = event.features?.[0]?.properties?.index;
      if (typeof index === 'number') onSelect(index);
    };
    map.addControl(new NavigationControl({ visualizePitch: false }), 'top-right');
    map.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-right');
    map.on('style.load', () => {
      applyMapTheme(map, readMapTheme());
      // Generic basemap imagery is never labelled as this fire's optical scene.
      if (map.getLayer('imagery')) map.setLayoutProperty('imagery', 'visibility', 'none');
      map.addSource('fires-cells', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: 'fires-cells-fill',
        type: 'fill',
        source: 'fires-cells',
        paint: {
          'fill-color': cellColor('stage'),
          'fill-opacity': [
            'case',
            ['==', ['get', 'confidence'], 0],
            0.15,
            ['==', ['get', 'zone'], 0],
            0.45,
            0.85,
          ],
        },
      });
      map.addLayer({
        id: 'fires-cells-outline',
        type: 'line',
        source: 'fires-cells',
        paint: { 'line-color': readMapTheme().label, 'line-width': 0.75 },
      });
      map.addLayer({
        id: 'fires-selected',
        type: 'line',
        source: 'fires-cells',
        filter: ['==', ['get', 'index'], -1],
        paint: { 'line-color': readMapTheme().stages[2], 'line-width': 3 },
      });
      const ring = [...corners, corners[0]!];
      map.addSource('fires-extent', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'Polygon', coordinates: [ring] },
        },
      });
      map.addLayer({
        id: 'fires-extent-line',
        source: 'fires-extent',
        type: 'line',
        paint: { 'line-color': readMapTheme().label, 'line-width': 1, 'line-dasharray': [3, 3] },
      });
      const perimeter = result.fire.perimeter;
      if (perimeter) {
        map.addSource('fires-perimeter', {
          type: 'geojson',
          data: { type: 'Feature', properties: {}, geometry: perimeter },
        });
        map.addLayer({
          id: 'fires-perimeter-line',
          type: 'line',
          source: 'fires-perimeter',
          paint: { 'line-color': readMapTheme().stages[2], 'line-width': 2 },
        });
      }
      map.addSource('fires-lidar', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: result.lidar_points.map((point) => ({
            type: 'Feature',
            properties: { height_m: point.height_m },
            geometry: { type: 'Point', coordinates: [point.lon, point.lat] },
          })),
        },
      });
      map.addLayer({
        id: 'fires-lidar-points',
        type: 'circle',
        source: 'fires-lidar',
        paint: {
          'circle-radius': 5,
          'circle-color': readMapTheme().background,
          'circle-stroke-color': readMapTheme().stages[2],
          'circle-stroke-width': 2,
        },
      });
      map.on('click', 'fires-cells-fill', select);
      map.on('mouseenter', 'fires-cells-fill', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'fires-cells-fill', () => {
        map.getCanvas().style.cursor = '';
      });
      setStatus('');
      setReady(true);
    });
    map.on('error', () =>
      setStatus(
        'Some map resources could not load. Use the cell readout to inspect the supplied values.',
      ),
    );
    const resize = new ResizeObserver(() => map.resize());
    resize.observe(host);
    return () => {
      resize.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, [result, onSelect]);

  useEffect(() => {
    const source = mapRef.current?.getSource('fires-cells') as GeoJSONSource | undefined;
    if (ready && source) source.setData(features);
  }, [ready, features]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map?.getLayer('fires-cells-fill')) return;
    applyMapTheme(map, readMapTheme());
    if (map.getLayer('imagery')) map.setLayoutProperty('imagery', 'visibility', 'none');
    map.setPaintProperty('fires-cells-fill', 'fill-color', cellColor(layer));
    map.setLayoutProperty('fires-lidar-points', 'visibility', showLidar ? 'visible' : 'none');
    const filter: FilterSpecification = ['==', ['get', 'index'], selectedCell ?? -1];
    map.setFilter('fires-selected', filter);
  }, [ready, layer, showLidar, selectedCell, themeId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map?.getLayer('fires-cells-fill')) return;
    if (!context) {
      if (map.getLayer('fires-water-fill'))
        map.setLayoutProperty('fires-water-fill', 'visibility', 'none');
      return;
    }
    const source = map.getSource<GeoJSONSource>('fires-water');
    if (source) source.setData(context.water);
    else {
      map.addSource('fires-water', {
        type: 'geojson',
        data: context.water,
        attribution: context.source.attribution,
      });
      map.addLayer(
        {
          id: 'fires-water-fill',
          type: 'fill',
          source: 'fires-water',
          paint: {
            'fill-color': readMapTheme().water,
            'fill-opacity': 0.8,
            'fill-outline-color': readMapTheme().waterLabel,
          },
        },
        'fires-cells-fill',
      );
    }
    map.setLayoutProperty('fires-water-fill', 'visibility', showWater ? 'visible' : 'none');
  }, [context, showWater, ready]);

  return (
    <div className={styles.map}>
      <div
        ref={hostRef}
        className={styles.mapCanvas}
        role="region"
        aria-label="Fire perimeter, recovery grid and GEDI points. Use the cell selector for keyboard access to values."
      />
      {status && (
        <p className={styles.mapStatus} role="status">
          {status}
        </p>
      )}
      <button
        type="button"
        disabled={!ready || selectedCell === null}
        className={`${styles.mapAction} ${styles.select}`}
        onClick={() => {
          const feature = features.features.find((cell) => cell.id === selectedCell);
          const ring = feature?.geometry.coordinates[0];
          if (!ring) return;
          mapRef.current?.fitBounds(
            [
              [
                Math.min(...ring.map((point) => point[0]!)),
                Math.min(...ring.map((point) => point[1]!)),
              ],
              [
                Math.max(...ring.map((point) => point[0]!)),
                Math.max(...ring.map((point) => point[1]!)),
              ],
            ],
            { padding: 80, maxZoom: 14, duration: 0 },
          );
        }}
      >
        Zoom to inspected cell
      </button>
    </div>
  );
}
