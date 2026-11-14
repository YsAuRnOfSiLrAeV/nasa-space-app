/**
 * The seam between future data and the illustrative scene.
 *
 * Today the scene draws one synthetic stand (`ILLUSTRATIVE_STAND`). Later, fire
 * grid cells, a recovery stage, a predicted recovery share, a selected year or
 * supplied elevation can be turned into the same `StandParams` here, without
 * the renderer knowing where they came from. No prediction logic lives here,
 * and no value below is a measurement.
 */

/** Inputs the viewer may accept later. All optional; none are used yet. */
export interface ForestStandInput {
  /** Model grid cells for one fire (shape owned by the data layer). */
  cells?: unknown[];
  /** Height stage 0 (<5 m), 1 (5–10 m) or 2 (>10 m). */
  recoveryStage?: 0 | 1 | 2;
  /** Predicted structural recovery, 0–1. */
  recoveryShare?: number;
  /** Selected summer. */
  year?: number;
  /** Supplied elevation grid (row-major, metres). */
  elevation?: { res: number; heights: ArrayLike<number> };
}

/** What the scene needs to build a stand. Pure numbers, illustrative. */
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

/** The single illustrative stand of the first milestone. */
export const ILLUSTRATIVE_STAND: StandParams = {
  seed: 20260714,
  spacing: 2.9,
  cover: 0.7,
  heightScale: 1,
  mix: { spruce: 0.36, fir: 0.2, pine: 0.14, broadleaf: 0.24, snag: 0.06 },
  shrubDensity: 9,
};

/**
 * Inputs → stand. For now always the illustrative stand: recovery inputs are
 * accepted so call sites can be written, but they do not change the scene yet.
 */
export function standFromInput(input: ForestStandInput = {}): StandParams {
  void input;
  return ILLUSTRATIVE_STAND;
}
