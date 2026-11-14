import { describe, expect, it } from 'vitest';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { LAYER_HILLSHADE, LAYER_POINT_GLOW, LAYER_POINT_SELECTED, LAYER_POINTS } from './layers';
import { StudyMapController } from './StudyMapController';

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
  const map = {
    getLayer: (id: string) => (layers.has(id) ? { id } : undefined),
    setLayoutProperty: (id: string, p: string, v: string) => calls.push(`layout ${id} ${p}=${v}`),
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

describe('StudyMapController theme overrides', () => {
  it('maps named layers to style layers and ignores missing ones', () => {
    const { view, calls, layers } = setup();
    view.setLayerVisible('relief', false);
    layers.delete(LAYER_POINTS);
    view.setLayerVisible('points', false);
    expect(calls).toEqual([`layout ${LAYER_HILLSHADE} visibility=none`]);
  });

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

  it('undoes every override in one call, whatever the previous theme did', () => {
    const { view, layers, container, handlers, projection, calls } = setup();
    // Earth Intelligence + Living Atlas style overrides:
    view.setProjection('globe');
    view.showPointGlow();
    view.enablePointSelection(() => {});
    view.setSelectedPoint('ontario-1');
    view.setInteractive(false);
    view.setLayerVisible('points', false);

    view.resetThemeOverrides();

    expect(projection()).toBe('mercator');
    expect(layers.has(LAYER_POINT_GLOW)).toBe(false);
    expect(layers.has(LAYER_POINT_SELECTED)).toBe(false);
    expect(handlers.get(`click:${LAYER_POINTS}`)).toHaveLength(0);
    expect(container.inert).toBe(false);
    expect(calls.at(-1)).toBe(`layout ${LAYER_POINTS} visibility=visible`);
  });

  it('is safe to reset when nothing was overridden', () => {
    const { view, layers } = setup();
    expect(() => view.resetThemeOverrides()).not.toThrow();
    expect(layers.has(LAYER_POINTS)).toBe(true);
  });
});
