/**
 * Illustrative species mix for a burn-scar group (pure, tested).
 *
 * The only site data about pre-fire vegetation is the MODIS MCD12Q1 2001 land-cover
 * class at each point; it says nothing about species. This maps each class to a
 * typical regional mix (see species.ts references) and weights by how many of the
 * group's points had each class. The result drives the drawing only and must be
 * labelled as illustrative, never as the group's measured composition.
 */
import type { ClassCount } from '@/domain/study/recovery';
import { SPECIES_ORDER, type SpeciesId } from './species';

type Mix = Partial<Record<SpeciesId, number>>;

/** IGBP class → typical regional mix (shares sum to 1). Illustrative. */
export const CLASS_MIX: Record<number, Mix> = {
  // Evergreen needleleaf forest: upland conifer stands.
  1: { 'jack-pine': 0.45, 'black-spruce': 0.4, 'trembling-aspen': 0.1, 'white-birch': 0.05 },
  // Deciduous broadleaf forest.
  4: { 'trembling-aspen': 0.6, 'white-birch': 0.4 },
  // Mixed forest.
  5: { 'trembling-aspen': 0.3, 'white-birch': 0.25, 'black-spruce': 0.25, 'jack-pine': 0.2 },
  // Woody savanna (30–60 % tree cover): open mixed stands.
  8: { 'jack-pine': 0.3, 'black-spruce': 0.25, 'trembling-aspen': 0.25, 'white-birch': 0.2 },
  // Savanna: sparse, mostly pine.
  9: { 'jack-pine': 0.5, 'trembling-aspen': 0.3, 'white-birch': 0.2 },
  // Permanent wetland: lowland conifers.
  11: { 'black-spruce': 0.6, tamarack: 0.4 },
};

/** Used for classes with no forest mapping (e.g. grassland). */
const FALLBACK: Mix = CLASS_MIX[8]!;

export interface SpeciesShare {
  id: SpeciesId;
  share: number;
}

export interface IllustrativeComposition {
  shares: SpeciesShare[];
  /** Plain-language basis, for the label next to the illustration. */
  basis: string;
}

export function illustrativeComposition(classes: ClassCount[]): IllustrativeComposition {
  const total = classes.reduce((s, c) => s + c.n, 0);
  const acc: Record<string, number> = {};
  for (const c of classes) {
    const mix = CLASS_MIX[c.code] ?? FALLBACK;
    for (const [sp, v] of Object.entries(mix)) acc[sp] = (acc[sp] ?? 0) + (v * c.n) / (total || 1);
  }
  const shares = SPECIES_ORDER.filter((id) => (acc[id] ?? 0) > 0)
    .map((id) => ({ id, share: Math.round(acc[id]! * 1000) / 1000 }))
    .sort((a, b) => b.share - a.share);
  const main = classes[0];
  const basis = main
    ? `Guided by the pre-fire cover class at this group's points (MODIS 2001: ${main.n} of ${total} ${main.label.toLowerCase()}) and regional forest ecology. Not a species inventory.`
    : 'Generic boreal mix. Not a species inventory.';
  return { shares, basis };
}
