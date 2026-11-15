/**
 * Boreal species used by the growth illustration. Traits are general ecology
 * of the boreal Shield in northwestern Ontario, written for a lay reader; they
 * describe the species, not what grows at any sample point.
 *
 * References (regional ecology, not site data):
 *  - Sims, R.A. et al. (1997). Field Guide to the Forest Ecosystem Classification
 *    for Northwestern Ontario. Ontario Ministry of Natural Resources.
 *  - Farrar, J.L. (1995). Trees in Canada. Fitzhenry & Whiteside / Canadian Forest Service.
 */

export type SpeciesId =
  'black-spruce' | 'jack-pine' | 'trembling-aspen' | 'white-birch' | 'tamarack';

export interface Species {
  id: SpeciesId;
  name: string;
  latin: string;
  kind: 'conifer' | 'broadleaf' | 'deciduous conifer';
  /** How it comes back after fire. */
  regeneration: string;
  /** What to look for in the illustration. */
  silhouette: string;
  /** Where it grows in the region. */
  habitat: string;
  /**
   * Illustration-only growth shape (Chapman–Richards): height = hMax·(1 − e^(−k·age))^p, in
   * drawing units. Chosen to show relative early pace, not measured growth rates.
   */
  growth: { hMax: number; k: number; p: number };
  /** Years after the fire in which new stems appear in the illustration: [first, last]. */
  establish: [number, number];
}

export const SPECIES: Record<SpeciesId, Species> = {
  'jack-pine': {
    id: 'jack-pine',
    name: 'Jack pine',
    latin: 'Pinus banksiana',
    kind: 'conifer',
    regeneration:
      'Many cones stay sealed with resin until fire heat opens them, so seed falls onto the freshly burned ground.',
    silhouette: 'Irregular, open crown of tufted needles; trunk often slightly crooked.',
    habitat: 'Dry, sandy or rocky uplands.',
    growth: { hMax: 300, k: 0.075, p: 1.6 },
    establish: [1, 4],
  },
  'black-spruce': {
    id: 'black-spruce',
    name: 'Black spruce',
    latin: 'Picea mariana',
    kind: 'conifer',
    regeneration:
      'Semi-sealed cones on the crown release seed after fire; seedlings start slowly and keep coming for years.',
    silhouette:
      'Very narrow spire of short drooping branches, with a dense club of cones at the top.',
    habitat: 'Uplands and wet lowlands alike; dominant on peat.',
    growth: { hMax: 260, k: 0.05, p: 1.9 },
    establish: [1, 9],
  },
  'trembling-aspen': {
    id: 'trembling-aspen',
    name: 'Trembling aspen',
    latin: 'Populus tremuloides',
    kind: 'broadleaf',
    regeneration:
      'Sprouts from its surviving roots ("suckers") within the first seasons, so it grows fastest early on.',
    silhouette: 'Straight pale trunk and a small rounded crown held high.',
    habitat: 'Well-drained uplands; often mixed with conifers.',
    growth: { hMax: 320, k: 0.12, p: 1.3 },
    establish: [0, 2],
  },
  'white-birch': {
    id: 'white-birch',
    name: 'White birch',
    latin: 'Betula papyrifera',
    kind: 'broadleaf',
    regeneration:
      'Light seed blows in from survivors and stumps resprout, often as clumps of several stems.',
    silhouette: 'White bark with dark horizontal marks; oval, open crown; often two or more stems.',
    habitat: 'Uplands with moist, well-drained soil.',
    growth: { hMax: 280, k: 0.09, p: 1.4 },
    establish: [1, 5],
  },
  tamarack: {
    id: 'tamarack',
    name: 'Tamarack',
    latin: 'Larix laricina',
    kind: 'deciduous conifer',
    regeneration:
      'Seeds onto open, wet ground; needs full light, so it establishes early after disturbance.',
    silhouette:
      'Airy cone of soft, light-green needles in tufts; the only conifer here that sheds its needles in autumn.',
    habitat: 'Wet, poorly drained lowlands and fens.',
    growth: { hMax: 270, k: 0.07, p: 1.6 },
    establish: [2, 7],
  },
};

export const SPECIES_ORDER: SpeciesId[] = [
  'jack-pine',
  'black-spruce',
  'trembling-aspen',
  'white-birch',
  'tamarack',
];
