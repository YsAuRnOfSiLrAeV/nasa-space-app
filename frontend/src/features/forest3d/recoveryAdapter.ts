/**
 * The seam between the model's numbers and the illustrative scene. Pure; the
 * renderer never sees where its parameters came from.
 *
 * A scene has two parts:
 *   StandParams   where every plant could stand (built once per scene);
 *   GrowthParams  how tall each plant is in a given year, and whether it is there.
 * Changing the year only changes GrowthParams, so trees grow in place.
 *
 * The documented mapping (also in docs/forest-3d.md):
 *
 *   From the model (data)
 *     tree height     = whole-fire modeled recovery for the year × the tree's mature
 *                       height. Recovery is a share of the reference forest height,
 *                       so 1 draws the reference forest.
 *     height spread   = where the fire has a cell timeline, each tree takes one
 *                       quantile of that year's modeled cell recovery instead, so the
 *                       spread of heights follows the spread of cells.
 *   Illustrative assumptions (not data)
 *     establishment   share of tree positions with a living tree = 0.25 + 1.5 × recovery.
 *     snags           fire-killed trunks still standing = exp(−age / 20 years).
 *     shrubs          share of shrub positions with a shrub = 1 − 0.75 × recovery (≥ 0.2).
 *     pioneers        broadleaf grows up to 1.5× faster while recovery is low.
 *
 * No value here is a measurement, and the picture is not a picture of any fire.
 */

/** Inputs for one year of one fire. */
export interface ForestStandInput {
  /** Modeled whole-fire recovery for the year: share of the reference forest height (0..~1.1). */
  recoveryShare: number;
  /** Years since the fire (negative: before it). */
  ageYears: number;
  /**
   * That year's modeled recovery of every cell, in percent (`timeline.json` row);
   * null values are cells without a value. Optional: without it every tree uses
   * `recoveryShare`.
   */
  cellRecovery?: readonly (number | null)[] | null;
}

/** What the scene needs to scatter a stand. Pure numbers, illustrative. */
export interface StandParams {
  seed: number;
  /** Mean spacing between trees, scene units (lower = denser). */
  spacing: number;
  /** 0–1: how much of the block is forested rather than open. */
  cover: number;
  /** Multiplier on tree heights (1 = mature illustrative stand). */
  heightScale: number;
  /** Share of each silhouette among trees; normalised by the scatterer. */
  mix: { spruce: number; fir: number; pine: number; broadleaf: number; snag: number };
  /** Shrubs per 100 square units of open ground. */
  shrubDensity: number;
}

/** How the stand looks in one year. Every plant keeps its position; only this changes. */
export interface GrowthParams {
  /** Tree height as a share of its mature height: the model's recovery (data). */
  heightScale: number;
  /** Sorted height shares from the cell timeline (data); each tree takes one quantile. */
  heightQuantiles: number[] | null;
  /** Share of tree positions with a living tree, 0..1 (illustrative). */
  establishment: number;
  /** Share of fire-killed snags still standing, 0..1 (illustrative). */
  snagSurvival: number;
  /** Share of shrub positions with a shrub, 0..1 (illustrative). */
  shrubShare: number;
  /** Height factor for broadleaf pioneers, ≥ 1 (illustrative). */
  pioneerBoost: number;
}

/** The single illustrative stand shown without data. */
export const ILLUSTRATIVE_STAND: StandParams = {
  seed: 20260714,
  spacing: 2.9,
  cover: 0.7,
  heightScale: 1,
  mix: { spruce: 0.36, fir: 0.2, pine: 0.14, broadleaf: 0.24, snag: 0.06 },
  shrubDensity: 9,
};

/**
 * The stand a fire's years are drawn on: a closed boreal stand with room for
 * pioneers, and a pool of trunks the fire killed. Every year shows a subset of it.
 */
export const GROWTH_STAND: StandParams = {
  seed: 20260714,
  spacing: 2.7,
  cover: 0.78,
  heightScale: 1,
  mix: { spruce: 0.34, fir: 0.16, pine: 0.14, broadleaf: 0.22, snag: 0.14 },
  shrubDensity: 12,
};

/** Every plant as scattered: the illustrative stand, unchanged. */
export const MATURE_GROWTH: GrowthParams = {
  heightScale: 1,
  heightQuantiles: null,
  establishment: 1,
  snagSurvival: 1,
  shrubShare: 1,
  pioneerBoost: 1,
};

/**
 * The reference forest, before the fire: what 100% recovery means. Living trees at
 * mature height, no fire-killed trunks yet, little understorey.
 */
export const REFERENCE_GROWTH: GrowthParams = {
  heightScale: 1,
  heightQuantiles: null,
  establishment: 1,
  snagSurvival: 0,
  shrubShare: 0.25,
  pioneerBoost: 1,
};

const clamp = (value: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, value));
/** Recovery above this is drawn at this height (the model can exceed 1 slightly). */
const MAX_SHARE = 1.15;
const QUANTILES = 21;

/** Sorted shares at 21 evenly spaced quantiles of the non-missing cell values (percent → share). */
export function cellHeightQuantiles(values: readonly (number | null)[]): number[] | null {
  const shares = values
    .filter((value): value is number => value !== null && Number.isFinite(value))
    .map((value) => clamp(value / 100, 0, MAX_SHARE))
    .sort((a, b) => a - b);
  if (!shares.length) return null;
  return Array.from(
    { length: QUANTILES },
    (_, k) => shares[Math.round((k / (QUANTILES - 1)) * (shares.length - 1))]!,
  );
}

/** One year of one fire → how the stand looks. The mapping is documented above. */
export function growthFromRecovery(input: ForestStandInput): GrowthParams {
  if (input.ageYears < 0) return REFERENCE_GROWTH;
  const recovery = clamp(input.recoveryShare, 0, MAX_SHARE);
  const settled = Math.min(1, recovery);
  return {
    heightScale: recovery,
    heightQuantiles: input.cellRecovery ? cellHeightQuantiles(input.cellRecovery) : null,
    establishment: clamp(0.25 + 1.5 * recovery, 0, 1),
    snagSurvival: Math.exp(-input.ageYears / 20),
    shrubShare: clamp(1 - 0.75 * settled, 0.2, 1),
    pioneerBoost: 1 + 0.5 * (1 - settled),
  };
}

/** The stand to scatter: the growth stand for a fire's years, the illustrative one without data. */
export function standFromInput(input?: ForestStandInput | null): StandParams {
  return input ? GROWTH_STAND : ILLUSTRATIVE_STAND;
}
