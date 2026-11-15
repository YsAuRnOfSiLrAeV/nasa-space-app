import { describe, expect, it } from 'vitest';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { StudyMapController } from './StudyMapController';
import { LAYER_FIRE_GRID, SOURCE_FIRE_GRID, type FireGridScene } from './fireLayers';

const square = (i: number) => ({
  type: 'Feature' as const,
  properties: { i, row: 0, col: i, _displayColor: '#123456' },
  geometry: {
    type: 'Polygon' as const,
    coordinates: [
      [
        [-121 + i, 52],
        [-120 + i, 52],
        [-120 + i, 51],
        [-121 + i, 51],
        [-121 + i, 52],
      ],
    ],
  },
});
const SCENE: FireGridScene = {
  corners: [
    [-121, 52],
    [-118, 52],
    [-118, 51],
    [-121, 51],
  ],
  cellGeometry: { type: 'FeatureCollection', features: [square(0), square(1), square(2)] },
  gridImage: 'data:image/png;base64,grid',
  zoneImage: null,
  zoneOutline: [],
  perimeter: null,
  gedi: [],
  opticalImage: null,
};
const COLORS = {
  zone: '#fff',
  extent: '#999',
  perimeter: '#fa0',
  gediFill: '#000',
  gediStroke: '#fff',
};

/** Records what reaches MapLibre: sources, data updates, paint changes and feature state. */
function setup() {
  const layers = new Set<string>();
  const sources = new Map<string, Record<string, unknown>>();
  const state = new Map<number, unknown>();
  const calls: string[] = [];
  const map = {
    getLayer: (id: string) => (layers.has(id) ? { id } : undefined),
    getSource: (id: string) =>
      sources.has(id) ? { setData: () => calls.push(`setData ${id}`) } : undefined,
    addSource: (id: string, spec: Record<string, unknown>) => {
      sources.set(id, spec);
      calls.push(`source ${id}`);
    },
    addLayer: (spec: { id: string }) => layers.add(spec.id),
    removeLayer: (id: string) => layers.delete(id),
    removeSource: (id: string) => {
      sources.delete(id);
      state.clear();
    },
    setPaintProperty: (id: string, name: string) => calls.push(`paint ${id} ${name}`),
    setFeatureState: (target: { source: string; id: number }, value: unknown) => {
      state.set(target.id, value);
      calls.push(`state ${target.source} ${target.id}`);
    },
    removeFeatureState: (target: { source: string }) => {
      state.clear();
      calls.push(`clear ${target.source}`);
    },
  };
  const view = new StudyMapController({
    map: map as unknown as MapLibreMap,
    bbox: [-95.5, 49.56, -92.5, 51.5],
    reducedMotion: () => false,
    padding: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
    themeColor: (_name, fallback) => fallback,
  });
  return { view, calls, sources, state };
}

describe('cell values on the fire grid (timeline years)', () => {
  it('addresses each supplied cell by its own index', () => {
    const { view, sources } = setup();
    view.showFireGrid(SCENE, COLORS);
    expect(sources.get(SOURCE_FIRE_GRID)).toMatchObject({ type: 'geojson', promoteId: 'i' });
  });

  it('gives every cell its value for the year and keeps a missing value distinct from zero', () => {
    const { view, state } = setup();
    view.showFireGrid(SCENE, COLORS);
    view.setFireCellValues([0, null, 87], ['#000000', '#ffffff']);
    expect(state.get(0)).toEqual({ v: 0 });
    expect(state.get(1)).toEqual({ v: -1 });
    expect(state.get(2)).toEqual({ v: 87 });
  });

  it('changes years without sending the polygons again or rebuilding the paint', () => {
    const { view, calls } = setup();
    view.showFireGrid(SCENE, COLORS);
    view.setFireCellValues([10, 20, 30], ['#000000', '#ffffff']);
    const afterFirstYear = calls.length;
    view.setFireCellValues([11, 21, 31], ['#000000', '#ffffff']);
    const secondYear = calls.slice(afterFirstYear);
    expect(secondYear).toEqual([0, 1, 2].map((id) => `state ${SOURCE_FIRE_GRID} ${id}`));
    expect(calls.filter((call) => call === `source ${SOURCE_FIRE_GRID}`)).toHaveLength(1);
    expect(calls.filter((call) => call.startsWith(`paint ${LAYER_FIRE_GRID}`))).toHaveLength(2);
    expect(calls.some((call) => call.startsWith('setData'))).toBe(false);
  });

  it('returns to the layer’s own colours when the timeline is switched off', () => {
    const { view, calls, state } = setup();
    view.showFireGrid(SCENE, COLORS);
    view.setFireCellValues([10, 20, 30]);
    view.setFireCellValues(null);
    expect(calls.at(-1)).toBe(`clear ${SOURCE_FIRE_GRID}`);
    expect(state.size).toBe(0);
  });

  it('carries no values over to the next fire', () => {
    const { view, state, calls } = setup();
    view.showFireGrid(SCENE, COLORS);
    view.setFireCellValues([10, 20, 30]);
    view.clearFireGrid();
    expect(state.size).toBe(0);
    view.showFireGrid(SCENE, COLORS);
    expect(state.size).toBe(0);
    // The next fire's layer starts from its own paint: the ramp is built again when needed.
    view.setFireCellValues([1, 2, 3]);
    expect(calls.filter((call) => call.startsWith(`paint ${LAYER_FIRE_GRID}`))).toHaveLength(4);
  });

  it('does nothing for a fire drawn as an image or not drawn at all', () => {
    const { view, calls } = setup();
    view.setFireCellValues([1, 2, 3]);
    view.showFireGrid({ ...SCENE, cellGeometry: undefined }, COLORS);
    view.setFireCellValues([1, 2, 3]);
    expect(calls.some((call) => call.startsWith('state') || call.startsWith('paint'))).toBe(false);
  });
});
