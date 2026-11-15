import { describe, expect, it } from 'vitest';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { LAYER_HILLSHADE, LAYER_POINT_GLOW, LAYER_POINTS } from './layers';
import { StudyMapController } from './StudyMapController';
import {
  LAYER_FIRE_GEDI,
  LAYER_FIRE_GRID,
  LAYER_FIRE_MARKER_LABELS,
  LAYER_FIRE_MARKERS,
  LAYER_FIRE_OPTICAL,
  LAYER_FIRE_PERIMETER,
  LAYER_FIRE_ZONE,
  SOURCE_FIRE_GRID,
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
  const map = {
    getLayer: (id: string) => (layers.has(id) ? { id } : undefined),
    getSource: (id: string) => {
      const s = sources.get(id);
      return s
        ? {
            setData: (data: unknown) => (s.data = data),
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
    getCanvas: () => ({ style: { cursor: '' } }),
    queryRenderedFeatures: () => [],
    setLayoutProperty: (id: string, p: string, v: string) => {
      layout.set(`${id} ${p}`, v);
      calls.push(`layout ${id} ${p}=${v}`);
    },
    addLayer: (spec: { id: string }, before?: string) => {
      layers.add(spec.id);
      calls.push(`add ${spec.id}${before ? ` before ${before}` : ''}`);
    },
    removeLayer: (id: string) => {
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
    sources,
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
  it('focuses with the shared padding and never zooms out', () => {
    const { view, calls } = setup();
    view.focus([-94, 50], { minZoom: 9, durationMs: 1400 });
    view.focus([-94, 50], { minZoom: 3 });
    expect(calls).toEqual([
      `flyTo ${JSON.stringify({ center: [-94, 50], zoom: 9, padding: PAD, duration: 1400 })}`,
      `flyTo ${JSON.stringify({ center: [-94, 50], zoom: 6, padding: PAD, duration: 1200 })}`,
    ]);
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
