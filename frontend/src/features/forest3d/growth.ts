/**
 * One year of growth applied to a scattered stand: the height each plant is drawn
 * at, 0 for a plant that is not there. Pure; the scene only turns heights into
 * instance matrices. Which plants appear is decided by each plant's fixed `rank`,
 * so from year to year the same trees stay, grow, and new ones join.
 */
import type { GrowthParams } from './recoveryAdapter';
import type { Plant } from './scatter';

/** Trees below this (scene units, about half a metre) are not drawn. */
export const MIN_VISIBLE_HEIGHT = 0.2;

/** Linear lookup in sorted quantiles at `t` in 0..1. */
export function quantileAt(quantiles: readonly number[], t: number): number {
  const position = Math.min(1, Math.max(0, t)) * (quantiles.length - 1);
  const lo = Math.floor(position);
  const hi = Math.min(quantiles.length - 1, lo + 1);
  return quantiles[lo]! + (quantiles[hi]! - quantiles[lo]!) * (position - lo);
}

export function plantHeight(plant: Plant, growth: GrowthParams): number {
  switch (plant.kind) {
    case 'snag':
      // Fire-killed trunks keep their height until they fall.
      return plant.rank < growth.snagSurvival ? plant.height : 0;
    case 'shrub':
      return plant.rank < growth.shrubShare ? plant.height : 0;
    default: {
      if (plant.rank >= growth.establishment) return 0;
      const share = growth.heightQuantiles
        ? quantileAt(growth.heightQuantiles, plant.heightRank)
        : growth.heightScale;
      const boost = plant.kind === 'broadleaf' ? growth.pioneerBoost : 1;
      const height = plant.height * Math.min(1.15, share * boost);
      return height < MIN_VISIBLE_HEIGHT ? 0 : height;
    }
  }
}

/** Heights of every plant, in the stand's order. */
export function growHeights(plants: readonly Plant[], growth: GrowthParams): Float32Array {
  const heights = new Float32Array(plants.length);
  plants.forEach((plant, index) => (heights[index] = plantHeight(plant, growth)));
  return heights;
}

/** Counts of what a year shows, for the caption beside the picture. */
export function growthSummary(plants: readonly Plant[], heights: Float32Array) {
  let trees = 0;
  let snags = 0;
  let shrubs = 0;
  plants.forEach((plant, index) => {
    if (!heights[index]) return;
    if (plant.kind === 'snag') snags++;
    else if (plant.kind === 'shrub') shrubs++;
    else trees++;
  });
  return { trees, snags, shrubs };
}
