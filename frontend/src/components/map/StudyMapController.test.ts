import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BundleIndexSchema, loadBundleV2 } from '@/data/bundleV2';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { LAYER_HILLSHADE, LAYER_POINT_GLOW, LAYER_POINTS } from './layers';
import { StudyMapController } from './StudyMapController';
import { ApplicabilityZonesSchema } from '@/data/applicabilityZones';
import {
  SOURCE_CONFIDENCE,
  CONFIDENCE_LAYERS,
  LAYER_CONFIDENCE_VERIFIED,
  LAYER_CONFIDENCE_EXTRAPOLATED,
  LAYER_CONFIDENCE_SOLID,
  LAYER_CONFIDENCE_DASHED,
} from './confidenceLayers';
import {
  LAYER_FIRE_GEDI,
  LAYER_FIRE_GRID,
  LAYER_FIRE_MARKER_LABELS,
  LAYER_FIRE_MARKERS,
  LAYER_FIRE_OPTICAL,
  LAYER_FIRE_PERIMETER,
  LAYER_FIRE_PERIMETER_FILL,
  LAYER_FIRE_ZONE,
  SOURCE_FIRE_GRID,
  SOURCE_FIRE_OPTICAL,
  SOURCE_FIRE_PERIMETER,
  SOURCE_FIRE_GEDI,
  SOURCE_CATALOG_PERIMETERS,
  LAYER_CATALOG_PERIMETERS,
  type FireGridScene,
} from './fireLayers';

const SCENE: FireGridScene = {
  corners: [
    [-121, 52],
    [-120, 52],
    [-120, 51],
    [-121, 51],
  ],
  gridImage: 'data:image/png;base64,grid',
  zoneImage: null,
  zoneOutline: [],
  perimeter: null,
  gedi: [[-120.5, 51.5]],
  opticalImage: null,
};
const COLORS = {
  zone: '#fff',
  extent: '#999',
  perimeter: '#fa0',
  gediFill: '#000',
  gediStroke: '#fff',
};

type Handler = (e?: unknown) => void;

/** Minimal stand-in for the MapLibre methods the controller uses; records every call. */
function fakeMap() {
  const calls: string[] = [];
  const layers = new Set([LAYER_POINTS, LAYER_HILLSHADE]);
  const layerSpecs = new Map<string, unknown>();
  const handlers = new Map<string, Handler[]>();
  const container = { inert: false };
  let projection = 'mercator';
  const on = (key: string, h: Handler) => handlers.set(key, [...(handlers.get(key) ?? []), h]);
  const off = (key: string, h: Handler) =>
    handlers.set(
      key,
      (handlers.get(key) ?? []).filter((x) => x !== h),
    );
  const emit = (key: string, e?: unknown) => (handlers.get(key) ?? []).forEach((h) => h(e));
  const sources = new Map<string, { data?: unknown; image?: unknown }>();
  const layout = new Map<string, string>();
  const featureStates = new Map<number, { v: number }>();
  const canvas = { style: { cursor: '' } };
  const map = {
    setFeatureState: ({ id }: { id: number }, state: { v: number }) => featureStates.set(id, state),
    removeFeatureState: () => featureStates.clear(),
    setPaintProperty: (id: string, property: string) => calls.push(`paint ${id} ${property}`),
    getLayer: (id: string) => (layers.has(id) ? { id } : undefined),
    getSource: (id: string) => {
      const s = sources.get(id);
      return s
        ? {
            setData: (data: unknown) => {
              s.data = data;
              calls.push(`data ${id}`);
            },
            updateImage: (image: unknown) => (s.image = image),
          }
        : undefined;
    },
    addSource: (id: string, spec: { data?: unknown; url?: string }) => {
      sources.set(id, { data: spec.data, image: spec.url });
      calls.push(`source ${id}`);
    },
    removeSource: (id: string) => {
      sources.delete(id);
      calls.push(`unsource ${id}`);
    },
    getLayoutProperty: (id: string, p: string) => layout.get(`${id} ${p}`),
    getCanvas: () => canvas,
    queryRenderedFeatures: () => [],
    setLayoutProperty: (id: string, p: string, v: string) => {
      layout.set(`${id} ${p}`, v);
      calls.push(`layout ${id} ${p}=${v}`);
    },
    addLayer: (spec: { id: string }, before?: string) => {
      layerSpecs.set(spec.id, spec);
      layers.add(spec.id);
      calls.push(`add ${spec.id}${before ? ` before ${before}` : ''}`);
    },
    removeLayer: (id: string) => {
      layerSpecs.delete(id);
      layers.delete(id);
      calls.push(`remove ${id}`);
    },
    setFilter: (id: string, f: unknown) => calls.push(`filter ${id} ${JSON.stringify(f)}`),
    setProjection: ({ type }: { type: string }) => (projection = type),
    getContainer: () => container,
    getZoom: () => 6,
    cameraForBounds: () => ({ center: [-94, 50.5], zoom: 7.2 }),
    flyTo: (o: Record<string, unknown>) => {
      calls.push(`flyTo ${JSON.stringify(o)}`);
      const once = handlers.get('moveend:once') ?? [];
      handlers.delete('moveend:once');
      once.forEach((h) => h());
    },
    jumpTo: (o: Record<string, unknown>) => calls.push(`jumpTo ${JSON.stringify(o)}`),
    once: (ev: string, h: Handler) => on(`${ev}:once`, h),
    on: (ev: string, a: string | Handler, b?: Handler) =>
      typeof a === 'string' ? on(`${ev}:${a}`, b!) : on(ev, a),
    off: (ev: string, a: string | Handler, b?: Handler) =>
      typeof a === 'string' ? off(`${ev}:${a}`, b!) : off(ev, a),
  };
  return {
    map: map as unknown as MapLibreMap,
    calls,
    layers,
    layerSpecs,
    sources,
    featureStates,
    container,
    emit,
    handlers,
    projection: () => projection,
  };
}

const PAD = { top: 80, right: 400, bottom: 40, left: 40 };
const setup = (reduced = false) => {
  const fake = fakeMap();
  const view = new StudyMapController({
    map: fake.map,
    bbox: [-95.5, 49.56, -92.5, 51.5],
    reducedMotion: () => reduced,
    padding: () => PAD,
    themeColor: (_name, fallback) => fallback,
  });
  return { ...fake, view };
};

describe('StudyMapController camera', () => {
  it('focuses on the middle of the uncovered area and never zooms out', () => {
    const { view, calls } = setup();
    view.focus([-94, 50], { minZoom: 9, durationMs: 1400 });
    view.focus([-94, 50], { minZoom: 3 });
    // PAD covers 400 px on the right and 80 px at the top: the target sits left of and below centre.
    const offset = [-180, 20];
    expect(calls).toEqual([
      `flyTo ${JSON.stringify({ center: [-94, 50], zoom: 9, offset, duration: 1400 })}`,
      `flyTo ${JSON.stringify({ center: [-94, 50], zoom: 6, offset, duration: 1200 })}`,
    ]);
  });

  it('never leaves padding on the map, which would pad every later fit twice', () => {
    const { view, calls } = setup();
    view.focus([-94, 50], { minZoom: 9 });
    expect(calls.some((call) => call.includes('"padding"'))).toBe(false);
  });

  it('makes every camera move instant when the user prefers reduced motion', async () => {
    const { view, calls } = setup(true);
    view.focus([-94, 50], { durationMs: 1400 });
    await view.fitStudyArea({ durationMs: 3200, curve: 1.6 });
    expect(calls.every((c) => c.includes('"duration":0'))).toBe(true);
  });

  it('fits the study area and resolves when the camera stops', async () => {
    const { view, calls } = setup();
    await expect(view.fitStudyArea({ durationMs: 3200, curve: 1.6 })).resolves.toBeUndefined();
    expect(calls[0]).toContain('"zoom":7.2');
    expect(calls[0]).toContain('"curve":1.6');
  });

  it('shows the whole Earth centred on the study area', () => {
    const { view, calls } = setup();
    view.showWholeEarth();
    expect(calls[0]).toBe(
      `jumpTo ${JSON.stringify({ center: [-94, 50.53], zoom: 1.4, bearing: 0, pitch: 0 })}`,
    );
  });
});

describe('StudyMapController presentation', () => {
  it('adds the glow under the points, once', () => {
    const { view, calls } = setup();
    view.showPointGlow();
    view.showPointGlow();
    expect(calls).toEqual([`add ${LAYER_POINT_GLOW} before ${LAYER_POINTS}`]);
  });

  it('reports picked points and does not stack click handlers', () => {
    const { view, emit, handlers } = setup();
    const picked: string[] = [];
    view.enablePointSelection((id) => picked.push(`a:${id}`));
    view.enablePointSelection((id) => picked.push(`b:${id}`));
    emit(`click:${LAYER_POINTS}`, { features: [{ properties: { point_id: 'ontario-1' } }] });
    expect(picked).toEqual(['b:ontario-1']);
    expect(handlers.get(`click:${LAYER_POINTS}`)).toHaveLength(1);
  });
});

describe('StudyMapController fires', () => {
  it('puts an optical image that loads late under the fire layers already drawn', () => {
    const { view, calls } = setup();
    view.showFireGrid(SCENE, COLORS); // the image has not loaded yet
    view.showFireGrid({ ...SCENE, opticalImage: 'rgb.png' }, COLORS);
    expect(calls).toContain(`add ${LAYER_FIRE_OPTICAL} before ${LAYER_FIRE_GRID}`);
  });

  it('uses supplied cell polygons and separate rotated optical corners, preserving sources on updates', () => {
    const { view, calls, sources } = setup();
    const scene: FireGridScene = {
      ...SCENE,
      opticalImage: 'rgb.png',
      opticalCorners: [
        [-121, 52],
        [-120, 52.1],
        [-119.9, 51],
        [-120.9, 50.9],
      ],
      cellGeometry: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            id: 'original-id',
            properties: { i: 0, _displayColor: '#123456' },
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [-121, 52],
                  [-120, 52],
                  [-120, 51],
                  [-121, 51],
                  [-121, 52],
                ],
              ],
            },
          },
        ],
      },
    };
    view.showFireGrid(scene, COLORS);
    view.showFireGrid(scene, COLORS);
    expect(sources.get(SOURCE_FIRE_GRID)?.data).toEqual(scene.cellGeometry);
    expect(sources.get(SOURCE_FIRE_OPTICAL)?.image).toEqual({
      url: 'rgb.png',
      coordinates: scene.opticalCorners,
    });
    expect(calls.filter((call) => call === `source ${SOURCE_FIRE_GRID}`)).toHaveLength(1);
    view.showFireGrid(SCENE, COLORS);
    expect(sources.get(SOURCE_FIRE_GRID)?.data).toBeUndefined();
  });
  it('replaces all four real fire scenes on one controller and removes unavailable overlays', async () => {
    const { view, sources, layers } = setup();
    const root = resolve(import.meta.dirname, '../../../public/data/bundle-v2');
    const read = async (path: string): Promise<unknown> =>
      JSON.parse(readFileSync(resolve(root, path), 'utf8'));
    const index = BundleIndexSchema.parse(await read('index.json'));
    for (const entry of index.fires.filter((entry) =>
      ['bc_2003_490', 'quebec_1995_1218', 'quebec_2010_557', 'ontario_1988_21'].includes(entry.id),
    )) {
      const data = await loadBundleV2('', entry, index.summer, (path) => read(path.slice(1)));
      const scene: FireGridScene = {
        ...SCENE,
        corners: data.result.map_grid.corners_lonlat,
        cellGeometry: data.bundle!.geometry,
        opticalCorners: data.bundle!.imageCorners!,
        opticalImage: data.opticalImageUrl,
        perimeter: data.result.fire.perimeter,
        gedi: data.result.lidar_points.map(({ lon, lat }) => [lon, lat]),
      };
      view.showFireGrid(scene, COLORS);
      // A second update exercises the image-source replacement path too.
      view.showFireGrid(scene, COLORS);
      expect(sources.get(SOURCE_FIRE_GRID)?.data).toEqual(scene.cellGeometry);
      expect(sources.get(SOURCE_FIRE_OPTICAL)?.image).toEqual({
        url: scene.opticalImage,
        coordinates: scene.opticalCorners,
      });
      expect(sources.get(SOURCE_FIRE_PERIMETER)?.data).toMatchObject({
        features: [{ geometry: scene.perimeter }],
      });
      expect(sources.get(SOURCE_FIRE_GEDI)?.data).toMatchObject({
        features: scene.gedi.map((coordinates) => ({ geometry: { coordinates } })),
      });
      view.setFireHighlight(
        data.bundle!.geometry.features[0]!.geometry.coordinates[0] as [number, number][],
        '#fff',
      );
      view.clearFireGrid();
      expect(layers.has('fires-highlight-line')).toBe(false);
      expect([...sources.keys()].filter((id) => id.startsWith('fires-'))).toEqual([]);
    }
    view.showFireGrid(
      { ...SCENE, cellGeometry: { type: 'FeatureCollection', features: [] }, gedi: [] },
      COLORS,
    );
    expect(sources.has(SOURCE_FIRE_OPTICAL)).toBe(false);
    expect(sources.get(SOURCE_FIRE_GRID)?.data).toEqual({
      type: 'FeatureCollection',
      features: [],
    });
    expect(sources.get(SOURCE_FIRE_GEDI)?.data).toEqual({
      type: 'FeatureCollection',
      features: [],
    });
  });

  it('draws markers once, hides the selected fire and reports picks without stacking handlers', () => {
    const { view, calls, emit, handlers } = setup();
    const picked: string[] = [];
    const markers = [{ id: 'a', label: 'A · 1995', lonlat: [-75, 50] as [number, number] }];
    view.showFireMarkers(markers, null, (id) => picked.push(`1:${id}`));
    view.showFireMarkers(markers, 'a', (id) => picked.push(`2:${id}`));
    expect(calls.filter((c) => c === `add ${LAYER_FIRE_MARKERS}`)).toHaveLength(1);
    expect(calls).toContain(
      `filter ${LAYER_FIRE_MARKER_LABELS} ${JSON.stringify(['!=', ['get', 'id'], 'a'])}`,
    );
    emit(`click:${LAYER_FIRE_MARKERS}`, { features: [{ properties: { id: 'a' } }] });
    expect(picked).toEqual(['2:a']);
    expect(handlers.get(`click:${LAYER_FIRE_MARKERS}`)).toHaveLength(1);
  });

  it('renders all catalog perimeters separately from selected-fire layers and hides them on leaving Examples', () => {
    const { view, sources, layers, calls } = setup();
    const path = resolve(import.meta.dirname, '../../../public/data/bundle-v2/perimeters.geojson');
    const data = JSON.parse(readFileSync(path, 'utf8'));
    view.showCatalogPerimeters(data, null);
    view.showCatalogPerimeters(data, 'bc_2003_490');
    expect(sources.get(SOURCE_CATALOG_PERIMETERS)?.data).toEqual(data);
    expect(calls.filter((call) => call === `source ${SOURCE_CATALOG_PERIMETERS}`)).toHaveLength(1);
    expect(calls).toContain(
      `filter ${LAYER_CATALOG_PERIMETERS} ${JSON.stringify(['!=', ['get', 'id'], 'bc_2003_490'])}`,
    );
    view.clearFireGrid();
    expect(layers.has(LAYER_CATALOG_PERIMETERS)).toBe(true);
    view.hideCatalogPerimeters();
    expect(layers.has(LAYER_CATALOG_PERIMETERS)).toBe(false);
    expect(sources.has(SOURCE_CATALOG_PERIMETERS)).toBe(false);
  });

  it('updates the grid image in place instead of adding a second source', () => {
    const { view, calls, sources } = setup();
    view.showFireGrid(SCENE, COLORS);
    view.showFireGrid({ ...SCENE, gridImage: 'data:image/png;base64,other' }, COLORS);
    expect(calls.filter((c) => c === `source ${SOURCE_FIRE_GRID}`)).toHaveLength(1);
    expect(calls.filter((c) => c === `add ${LAYER_FIRE_GRID}`)).toHaveLength(1);
    expect(sources.get(SOURCE_FIRE_GRID)?.image).toEqual({
      url: 'data:image/png;base64,other',
      coordinates: SCENE.corners,
    });
  });

  it('adds optional layers only when their data exists and removes them when it goes', () => {
    const { view, layers } = setup();
    view.showFireGrid({ ...SCENE, opticalImage: 'optical.png', zoneImage: 'zone.png' }, COLORS);
    expect(layers.has(LAYER_FIRE_OPTICAL)).toBe(true);
    expect(layers.has(LAYER_FIRE_ZONE)).toBe(true);
    view.showFireGrid(SCENE, COLORS);
    expect(layers.has(LAYER_FIRE_OPTICAL)).toBe(false);
    expect(layers.has(LAYER_FIRE_ZONE)).toBe(false);
  });

  it('switches overlays by visibility and clears every fire layer', () => {
    const { view, calls, layers } = setup();
    view.showFireGrid(SCENE, COLORS);
    view.setFireOverlays({ perimeter: false, zone: true, gedi: false, optical: true });
    expect(calls).toContain(`layout ${LAYER_FIRE_PERIMETER} visibility=none`);
    expect(calls).toContain(`layout ${LAYER_FIRE_GEDI} visibility=none`);
    view.clearFireGrid();
    expect([...layers].some((id) => id.startsWith('fires-'))).toBe(false);
  });
  it('changes scalar values through feature state without replacing polygons and toggles cells independently', () => {
    const { view, calls, featureStates, map, layers } = setup();
    view.showFireGrid(
      { ...SCENE, cellGeometry: { type: 'FeatureCollection', features: [] } },
      COLORS,
    );
    const before = calls.length;
    view.setFireCellValues([0, null, 100]);
    view.setFireCellValues([50, 0, null]);
    expect(featureStates.get(0)).toEqual({ v: 50 });
    expect(featureStates.get(1)).toEqual({ v: 0 });
    expect(featureStates.get(2)).toEqual({ v: -1 });
    expect(
      calls.slice(before).some((call) => call.startsWith('data ') || call.startsWith('source ')),
    ).toBe(false);
    view.setFireOverlays({
      cells: false,
      perimeter: true,
      gedi: true,
      optical: false,
      zone: false,
    });
    expect(map.getLayoutProperty(LAYER_FIRE_GRID, 'visibility')).toBe('none');
    expect(map.getLayoutProperty(LAYER_FIRE_GEDI, 'visibility')).toBe('visible');
    expect(map.getLayoutProperty(LAYER_FIRE_PERIMETER_FILL, 'visibility')).toBe('visible');
    view.clearFireGrid();
    expect(layers.has(LAYER_FIRE_PERIMETER_FILL)).toBe(false);
  });

  it('reports interactive perimeter hits and ignores hidden perimeter polygons', () => {
    const { view, map, emit } = setup();
    view.showFireGrid(SCENE, COLORS);
    map.queryRenderedFeatures = (() => [{ properties: {} }]) as never;
    const hits: (boolean | undefined)[] = [];
    const off = view.onFirePointer((event) => hits.push(event.perimeterHit));
    const at = { lngLat: { lng: -120.5, lat: 51.5 }, point: { x: 1, y: 2 } };
    emit('click', at);
    view.setFireOverlays({
      cells: false,
      perimeter: false,
      gedi: false,
      optical: false,
      zone: false,
    });
    emit('click', at);
    expect(hits).toEqual([true, undefined]);
    off();
  });
  it('selects known fire polygon interiors and removes search/drawing handlers and geometry on cleanup', () => {
    const { view, layers, sources, emit, handlers, map } = setup();
    const ids: string[] = [];
    const off = view.showSearchGeometry({ type: 'FeatureCollection', features: [] }, (id) =>
      ids.push(id),
    );
    expect(layers.has('search-geometry-fill')).toBe(true);
    emit('click:search-geometry-fill', { features: [{ properties: { fireId: 'bc_2003_490' } }] });
    emit('click:search-geometry-fill', { features: [{ properties: { layer: 'model1_region' } }] });
    expect(ids).toEqual(['bc_2003_490']);
    const vertices: unknown[] = [];
    const stop = view.onDrawPoint((point) => vertices.push(point));
    expect(map.getCanvas().style.cursor).toBe('crosshair');
    emit('click', { lngLat: { lng: -120, lat: 51 } });
    expect(vertices).toEqual([[-120, 51]]);
    stop();
    off();
    expect(handlers.get('click')).toHaveLength(0);
    expect(handlers.get('click:search-geometry-fill')).toHaveLength(0);
    expect(layers.has('search-geometry-fill')).toBe(false);
    expect(sources.has('search-geometry')).toBe(false);
    expect(map.getCanvas().style.cursor).toBe('');
  });

  it('draws original confidence geometry below scientific layers and separates provider classifications without moving the camera', () => {
    const { view, layers, layerSpecs, sources, calls } = setup();
    const path = resolve(
      import.meta.dirname,
      '../../../public/data/bundle-v2/confidence_zones.geojson',
    );
    const data = ApplicabilityZonesSchema.parse(JSON.parse(readFileSync(path, 'utf8')));
    view.showFireGrid({ ...SCENE, opticalImage: 'source-rgb.png' }, COLORS);
    const before = calls.length;
    view.showConfidenceZones(data, 'model1_region');
    expect(sources.get(SOURCE_CONFIDENCE)?.data).toEqual(data);
    expect(layerSpecs.get(LAYER_CONFIDENCE_VERIFIED)).toMatchObject({
      type: 'fill',
      paint: { 'fill-opacity': ['coalesce', ['get', 'opacity'], 0.15] },
    });
    expect(layerSpecs.get(LAYER_CONFIDENCE_EXTRAPOLATED)).toMatchObject({
      type: 'fill',
      paint: { 'fill-opacity': ['coalesce', ['get', 'opacity'], 0.05] },
    });
    expect(layerSpecs.get(LAYER_CONFIDENCE_DASHED)).toMatchObject({
      type: 'line',
      paint: { 'line-dasharray': [3, 3] },
    });
    expect(layerSpecs.get(LAYER_CONFIDENCE_SOLID)).toMatchObject({ type: 'line' });
    expect(calls).toContain(`add ${LAYER_CONFIDENCE_VERIFIED} before ${LAYER_FIRE_OPTICAL}`);
    for (const classification of ['model1_region', 'model2_growth', 'model2_scenario'] as const) {
      view.showConfidenceZones(data, classification);
      expect(calls).toContain(
        `filter ${LAYER_CONFIDENCE_VERIFIED} ${JSON.stringify(['all', ['==', ['get', 'layer'], classification], ['==', ['get', 'status'], 'verified']])}`,
      );
      expect(calls).toContain(
        `filter ${LAYER_CONFIDENCE_DASHED} ${JSON.stringify(['all', ['==', ['get', 'layer'], classification], ['==', ['get', 'status'], 'extrapolated']])}`,
      );
    }
    expect(calls.filter((call) => call === `source ${SOURCE_CONFIDENCE}`)).toHaveLength(1);
    expect(calls).not.toContain(`data ${SOURCE_CONFIDENCE}`);
    expect(
      calls.slice(before).some((call) => call.startsWith('flyTo') || call.startsWith('jumpTo')),
    ).toBe(false);
    view.clearFireGrid();
    expect(layers.has(LAYER_CONFIDENCE_VERIFIED)).toBe(true);
    view.clearConfidenceZones();
    expect(CONFIDENCE_LAYERS.some((id) => layers.has(id))).toBe(false);
    expect(sources.has(SOURCE_CONFIDENCE)).toBe(false);
  });

  it('flies to bounds with the shared padding and resolves when the camera stops', async () => {
    const { view, calls } = setup();
    await view.focusBounds(
      [
        [-121, 51],
        [-120, 52],
      ],
      { durationMs: 2000 },
    );
    expect(calls[0]).toContain('"duration":2000');
    expect(calls[0]).toContain('"bearing":0');
  });

  it('never passes an undefined curve to MapLibre (it would replace the default and yield NaN)', async () => {
    const { view, map } = setup();
    const options: Record<string, unknown>[] = [];
    const fly = map.flyTo.bind(map);
    map.flyTo = ((o: Record<string, unknown>) => {
      options.push(o);
      return fly(o as never);
    }) as typeof map.flyTo;
    await view.focusBounds([
      [-121, 51],
      [-120, 52],
    ]);
    await view.fitStudyArea();
    await view.focusBounds(
      [
        [-121, 51],
        [-120, 52],
      ],
      { curve: 1.6 },
    );
    expect(options.map((o) => 'curve' in o)).toEqual([false, false, true]);
  });

  it('outlines one inspected cell and clears it with the grid', () => {
    const { view, layers, sources } = setup();
    view.setFireHighlight(null, '#fff');
    expect(layers.has('fires-highlight-line')).toBe(false);
    const ring: [number, number][] = [
      [-121, 52],
      [-120, 52],
      [-120, 51],
      [-121, 52],
    ];
    view.setFireHighlight(ring, '#fff');
    view.setFireHighlight(null, '#fff');
    expect(layers.has('fires-highlight-line')).toBe(true);
    expect(sources.get('fires-highlight')?.data).toMatchObject({ features: [] });
    view.clearFireGrid();
    expect(layers.has('fires-highlight-line')).toBe(false);
  });

  it('reports pointer moves, taps and exits, and unsubscribes', () => {
    const { view, emit, handlers } = setup();
    const seen: string[] = [];
    const off = view.onFirePointer((e) => seen.push(`${e.type}:${e.lngLat?.join(',') ?? '-'}`));
    const at = { lngLat: { lng: -120.5, lat: 51.5 }, point: { x: 1, y: 2 } };
    emit('mousemove', at);
    emit('click', at);
    emit('mouseout');
    emit('movestart');
    expect(seen).toEqual(['move:-120.5,51.5', 'click:-120.5,51.5', 'leave:-', 'reset:-']);
    off();
    expect(handlers.get('mousemove')).toHaveLength(0);
  });
});
