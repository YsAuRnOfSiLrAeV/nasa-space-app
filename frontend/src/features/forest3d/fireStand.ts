/**
 * The stand and landscape for one fire, from numbers we know about it. Pure.
 *
 *   Data         the neighbouring forest's height (GEDI) sets how tall the trees can grow;
 *                the real burn perimeter sets the shape of the burn on the block.
 *   Illustrative a landscape unique to the fire id (so no two fires share one), and the
 *                species mix and relief typical of the region, not of the site.
 */
import { burnShapeFromPerimeter, type PerimeterLike } from './burn';
import { GROWTH_STAND, type StandParams } from './recoveryAdapter';

export interface FireSceneInput {
  id: string;
  /** Region code from the fire id (`bc`, `alberta`, `ontario`, `quebec`, `manitoba`, …). */
  region: string | null;
  /** The neighbouring forest's height in metres (what 100% recovery means), if supplied. */
  referenceHeightM: number | null;
  perimeter: PerimeterLike | null;
}

/** The tall boreal stand the illustration is drawn at; the scale is relative to it. */
const ANCHOR_HEIGHT_M = 18;
const BLOCK_SIZE = 120;

/** FNV-1a: the same id always gives the same landscape. */
export function seedFromId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Relief and species mix typical of a region (illustrative, not measured at the fire). */
const CHARACTER: Record<string, { relief: number; mix: StandParams['mix'] }> = {
  // Cordillera: steeper ground, more pine and fir.
  mountain: {
    relief: 26,
    mix: { spruce: 0.28, fir: 0.24, pine: 0.26, broadleaf: 0.08, snag: 0.14 },
  },
  // Canadian Shield and prairie edge: low relief, spruce with aspen and birch.
  shield: {
    relief: 9,
    mix: { spruce: 0.4, fir: 0.14, pine: 0.1, broadleaf: 0.22, snag: 0.14 },
  },
  // Eastern boreal: rolling, spruce and fir with broadleaf.
  eastern: {
    relief: 14,
    mix: { spruce: 0.36, fir: 0.24, pine: 0.06, broadleaf: 0.2, snag: 0.14 },
  },
};

export function characterOf(region: string | null): keyof typeof CHARACTER {
  if (region === 'bc' || region === 'alberta') return 'mountain';
  if (region === 'quebec') return 'eastern';
  return 'shield';
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function standForFire(input: FireSceneInput): StandParams {
  const seed = seedFromId(input.id);
  const character = CHARACTER[characterOf(input.region)]!;
  const burn = burnShapeFromPerimeter(input.perimeter, BLOCK_SIZE);
  return {
    ...GROWTH_STAND,
    seed,
    heightScale: input.referenceHeightM
      ? clamp(input.referenceHeightM / ANCHOR_HEIGHT_M, 0.5, 1.2)
      : GROWTH_STAND.heightScale,
    mix: character.mix,
    terrain: { relief: character.relief, variant: (seed % 1000) / 1000 },
    ...(burn && { burn }),
  };
}
