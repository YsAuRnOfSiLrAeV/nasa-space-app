import type { FireData } from '@/data/fireSchema';
import { timelineRow } from './cellTimeline';

export const SPATIAL_LAYERS = {
  recovery: { label: 'Modeled recovery', unit: '% of reference forest height', field: 'recovery' },
  height: { label: 'Modeled canopy height', unit: 'm', field: 'height_m' },
  ndvi: { label: 'NDVI', unit: 'unitless', field: 'ndvi' },
  score: {
    label: 'Relative model score',
    unit: '0–1 ranking, not calibrated probability',
    field: 'p_forest_gt5',
  },
} as const;
export type SpatialLayerId = keyof typeof SPATIAL_LAYERS;
export const SPATIAL_LAYER_IDS = Object.keys(SPATIAL_LAYERS) as SpatialLayerId[];
export const SPATIAL_RAMP = ['#3d6fa8', '#d6ecff'] as const;

/** Values stay in scientific units; only the map's feature-state values are normalized. */
export function spatialValues(data: FireData, layer: SpatialLayerId, timelineYear?: number | null) {
  const bundle = data.bundle;
  const timeline =
    bundle?.timeline && timelineYear != null ? timelineRow(bundle.timeline, timelineYear) : null;
  const values =
    timelineYear != null
      ? (timeline ?? bundle?.cells.map(() => null) ?? [])
      : (bundle?.cells.map((cell) => {
          const value = cell[SPATIAL_LAYERS[layer].field];
          return value == null ? null : layer === 'recovery' ? value * 100 : value;
        }) ?? []);
  const active = timelineYear != null ? 'recovery' : layer;
  const maximum = values.reduce<number>(
    (max, value) => (value == null ? max : Math.max(max, value)),
    0,
  );
  const min = active === 'ndvi' ? -1 : 0;
  const max =
    active === 'score' || active === 'ndvi'
      ? 1
      : active === 'recovery'
        ? Math.max(100, maximum)
        : Math.max(1, maximum);
  return {
    layer: active,
    values,
    min,
    max,
    normalized: values.map((value) => (value == null ? null : ((value - min) / (max - min)) * 100)),
  };
}
