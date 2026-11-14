/**
 * Bridges CSS theme variables to MapLibre, which can't read CSS.
 * Reads `--map-*` and `--stage-*` from <html> and recolors basemap layers by role
 * plus the app's data layers. Called on map load and on every theme switch.
 *
 * Basemap roles are inferred from OpenMapTiles layer IDs, so editing the style
 * JSON (adding/removing layers) doesn't require code changes. Unknown layers keep
 * the style's own paint.
 */
import type { Map as MapLibreMap, ExpressionSpecification } from 'maplibre-gl';

import { LAYER_HILLSHADE, LAYER_IMAGERY, LAYER_POINTS } from './layers';

export { LAYER_HILLSHADE, LAYER_IMAGERY, LAYER_POINTS, SOURCE_POINTS } from './layers';

const FONT_REGULAR = ['Noto Sans Regular'];
const FONT_ITALIC = ['Noto Sans Italic'];

export interface MapTheme {
  background: string;
  water: string;
  waterOpacity: number;
  waterway: string;
  road: string;
  roadOpacity: number;
  boundary: string;
  label: string;
  waterLabel: string;
  labelHalo: string;
  imageryOpacity: number;
  imagerySaturation: number;
  imageryBrightness: number;
  imageryContrast: number;
  hillshadeExaggeration: number;
  hillshadeShadow: string;
  hillshadeHighlight: string;
  waterLabelItalic: boolean;
  pointStroke: string;
  pointScale: number;
  stages: [string, string, string];
}

export function readMapTheme(root: HTMLElement = document.documentElement): MapTheme {
  const css = getComputedStyle(root);
  const str = (name: string, fallback: string) =>
    css.getPropertyValue(`--${name}`).trim() || fallback;
  const num = (name: string, fallback: number) => {
    const v = Number.parseFloat(css.getPropertyValue(`--${name}`));
    return Number.isFinite(v) ? v : fallback;
  };
  return {
    background: str('map-background', '#000'),
    water: str('map-water', '#123'),
    waterOpacity: num('map-water-opacity', 1),
    waterway: str('map-waterway', '#234'),
    road: str('map-road', '#333'),
    roadOpacity: num('map-road-opacity', 1),
    boundary: str('map-boundary', '#555'),
    label: str('map-label', '#999'),
    waterLabel: str('map-water-label', '#789'),
    labelHalo: str('map-label-halo', '#000'),
    imageryOpacity: num('map-imagery-opacity', 0),
    imagerySaturation: num('map-imagery-saturation', 0),
    imageryBrightness: num('map-imagery-brightness', 1),
    imageryContrast: num('map-imagery-contrast', 0),
    hillshadeExaggeration: num('map-hillshade-exaggeration', 0),
    hillshadeShadow: str('map-hillshade-shadow', '#000'),
    hillshadeHighlight: str('map-hillshade-highlight', '#fff'),
    waterLabelItalic: num('map-water-label-italic', 0) > 0,
    pointStroke: str('map-point-stroke', '#000'),
    pointScale: num('map-point-scale', 1),
    stages: [str('stage-0', '#3f7a55'), str('stage-1', '#62ad7c'), str('stage-2', '#9fdcb0')],
  };
}

type PaintProperty = Parameters<MapLibreMap['setPaintProperty']>[1];
type PaintValue = Parameters<MapLibreMap['setPaintProperty']>[2];
type Paint = Partial<Record<PaintProperty, PaintValue>>;

function basemapPaintFor(id: string, type: string, t: MapTheme): Paint | null {
  if (id === 'background') return { 'background-color': t.background };
  if (id === 'water') return { 'fill-color': t.water, 'fill-opacity': t.waterOpacity };
  if (id === 'waterway') return { 'line-color': t.waterway };
  if (type === 'line' && /^(highway_|road_|railway)/.test(id)) {
    // Casings take the ground color so roads read as single thin strokes.
    return id.includes('casing')
      ? { 'line-color': t.background, 'line-opacity': t.roadOpacity }
      : { 'line-color': t.road, 'line-opacity': t.roadOpacity };
  }
  if (type === 'line' && id.startsWith('boundary_')) return { 'line-color': t.boundary };
  if (type === 'symbol') {
    return {
      'text-color': id.startsWith('water') ? t.waterLabel : t.label,
      'text-halo-color': t.labelHalo,
    };
  }
  return null;
}

const stageColor = (t: MapTheme): ExpressionSpecification => [
  'match',
  ['get', 'lidar_stage'],
  0,
  t.stages[0],
  1,
  t.stages[1],
  t.stages[2],
];

export function applyMapTheme(map: MapLibreMap, t: MapTheme): void {
  for (const layer of map.getStyle().layers) {
    if (layer.id === LAYER_IMAGERY) {
      // Hidden layers don't request tiles, so themes without imagery cost no bandwidth.
      map.setLayoutProperty(LAYER_IMAGERY, 'visibility', t.imageryOpacity > 0 ? 'visible' : 'none');
      map.setPaintProperty(LAYER_IMAGERY, 'raster-opacity', t.imageryOpacity);
      map.setPaintProperty(LAYER_IMAGERY, 'raster-saturation', t.imagerySaturation);
      map.setPaintProperty(LAYER_IMAGERY, 'raster-brightness-max', t.imageryBrightness);
      map.setPaintProperty(LAYER_IMAGERY, 'raster-contrast', t.imageryContrast);
      continue;
    }
    if (layer.id === LAYER_HILLSHADE) {
      map.setLayoutProperty(
        LAYER_HILLSHADE,
        'visibility',
        t.hillshadeExaggeration > 0 ? 'visible' : 'none',
      );
      map.setPaintProperty(LAYER_HILLSHADE, 'hillshade-exaggeration', t.hillshadeExaggeration);
      map.setPaintProperty(LAYER_HILLSHADE, 'hillshade-shadow-color', t.hillshadeShadow);
      map.setPaintProperty(LAYER_HILLSHADE, 'hillshade-accent-color', t.hillshadeShadow);
      map.setPaintProperty(LAYER_HILLSHADE, 'hillshade-highlight-color', t.hillshadeHighlight);
      continue;
    }
    if (layer.id === LAYER_POINTS) continue;
    // Cartographic convention: hydrography labels in italic (fonts served by OpenFreeMap).
    if (layer.type === 'symbol' && layer.id.startsWith('water')) {
      map.setLayoutProperty(layer.id, 'text-font', t.waterLabelItalic ? FONT_ITALIC : FONT_REGULAR);
    }
    const paint = basemapPaintFor(layer.id, layer.type, t);
    if (!paint) continue;
    for (const [prop, value] of Object.entries(paint) as [PaintProperty, PaintValue][]) {
      map.setPaintProperty(layer.id, prop, value);
    }
  }

  if (map.getLayer(LAYER_POINTS)) {
    const burned: ExpressionSpecification = ['==', ['get', 'status'], 'burned'];
    const s = t.pointScale;
    map.setPaintProperty(LAYER_POINTS, 'circle-radius', [
      'interpolate',
      ['linear'],
      ['zoom'],
      5,
      3 * s,
      10,
      6 * s,
      14,
      9 * s,
    ]);
    map.setPaintProperty(LAYER_POINTS, 'circle-color', stageColor(t));
    map.setPaintProperty(LAYER_POINTS, 'circle-stroke-color', [
      'case',
      burned,
      t.pointStroke,
      stageColor(t),
    ]);
  }
}
