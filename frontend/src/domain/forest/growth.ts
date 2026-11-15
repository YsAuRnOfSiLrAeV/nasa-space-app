/**
 * Deterministic model of the illustrated forest (pure, tested). Everything is
 * drawn from a seeded generator once per group; the year only changes sizes,
 * densities and which elements are visible. Same group + same year = same
 * picture. Fractional years are allowed so transitions can be animated.
 *
 * All sizes are drawing units in a 1200 × 520 scene, not metres. Nothing here
 * is a measurement or a prediction.
 */
import { SPECIES, type SpeciesId } from './species';
import type { SpeciesShare } from './composition';

export const SCENE_W = 1200;
export const SCENE_H = 520;
export const GROUND_Y = 440;
export const MAX_YEAR = 30;

/** Mulberry32: small, fast, deterministic. */
export function seededRandom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Ground height offset at x: gentle, deterministic undulation. */
export function groundAt(x: number, seed: number): number {
  const p = (seed % 1000) / 1000;
  return (
    GROUND_Y +
    Math.sin(x / 140 + p * 6.28) * 6 +
    Math.sin(x / 57 + p * 3.1) * 2.5 +
    Math.sin(x / 23 + p * 1.7) * 1
  );
}

export interface PlannedTree {
  key: string;
  species: SpeciesId;
  x: number;
  /** 0 = front row, 1 = back row (smaller, paler). */
  depth: 0 | 1;
  establishYear: number;
  vigor: number;
  /** Year it dies in self-thinning, or null. */
  diesAt: number | null;
  /** Shape variation, 0–1. */
  variant: number;
  /** Birch: number of stems. */
  stems: number;
}

export interface PlannedSnag {
  key: string;
  x: number;
  height: number;
  lean: number;
  fallsAt: number;
  depth: 0 | 1;
}

export interface Plan {
  seed: number;
  trees: PlannedTree[];
  snags: PlannedSnag[];
  /** x positions of ground-layer plants, each with an appearance year and type. */
  ground: { key: string; x: number; kind: GroundKind; from: number; until: number; size: number }[];
}

export type GroundKind = 'grass' | 'fireweed' | 'shrub' | 'moss' | 'litter';

/** Lifetimes of ground plants in the illustration (years after fire). */
const GROUND_SPANS: Record<GroundKind, { from: [number, number]; until: [number, number] }> = {
  grass: { from: [0.6, 3], until: [14, 30] },
  fireweed: { from: [0.8, 2.5], until: [6, 13] },
  shrub: { from: [2, 8], until: [31, 31] },
  moss: { from: [3, 14], until: [31, 31] },
  litter: { from: [4, 16], until: [31, 31] },
};

const GROUND_COUNTS: Record<GroundKind, number> = {
  grass: 60,
  fireweed: 26,
  shrub: 22,
  moss: 40,
  litter: 34,
};

export const TREE_COUNT = 46;
export const SNAG_COUNT = 14;

/** Everything random, decided once per group. */
export function planForest(groupId: string, shares: SpeciesShare[]): Plan {
  const seed = hashString(groupId);
  const rnd = seededRandom(seed);
  const between = ([a, b]: [number, number]) => a + rnd() * (b - a);

  // Largest-remainder allocation so counts follow the shares exactly.
  const raw = shares.map((s) => ({ id: s.id, n: s.share * TREE_COUNT }));
  const counts = raw.map((r) => ({ id: r.id, n: Math.floor(r.n), rem: r.n - Math.floor(r.n) }));
  let left = TREE_COUNT - counts.reduce((s, c) => s + c.n, 0);
  for (const c of [...counts].sort((a, b) => b.rem - a.rem)) {
    if (left-- <= 0) break;
    c.n++;
  }
  const speciesList = counts.flatMap((c) => Array.from({ length: c.n }, () => c.id));
  // Shuffle so species interleave across the scene.
  for (let i = speciesList.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [speciesList[i], speciesList[j]] = [speciesList[j]!, speciesList[i]!];
  }

  const slot = SCENE_W / speciesList.length;
  const trees: PlannedTree[] = speciesList.map((species, i) => {
    const sp = SPECIES[species];
    const depth: 0 | 1 = rnd() < 0.42 ? 1 : 0;
    const vigor = 0.72 + rnd() * 0.5;
    return {
      key: `t${i}`,
      species,
      x: Math.round((i + 0.15 + rnd() * 0.7) * slot),
      depth,
      establishYear: Math.round(between(sp.establish) * 10) / 10,
      vigor,
      // Weaker stems drop out as the canopy closes (self-thinning).
      diesAt: vigor < 0.84 && rnd() < 0.6 ? Math.round(between([13, 28]) * 10) / 10 : null,
      variant: rnd(),
      stems: species === 'white-birch' && rnd() < 0.55 ? 2 + (rnd() < 0.3 ? 1 : 0) : 1,
    };
  });

  const snags: PlannedSnag[] = Array.from({ length: SNAG_COUNT }, (_, i) => ({
    key: `s${i}`,
    x: Math.round((i + 0.2 + rnd() * 0.6) * (SCENE_W / SNAG_COUNT)),
    height: 120 + rnd() * 150,
    lean: (rnd() - 0.5) * 0.12,
    fallsAt: Math.round(between([4, 26]) * 10) / 10,
    depth: rnd() < 0.4 ? 1 : 0,
  }));

  const ground: Plan['ground'] = [];
  for (const kind of Object.keys(GROUND_COUNTS) as GroundKind[]) {
    const n = GROUND_COUNTS[kind];
    for (let i = 0; i < n; i++) {
      ground.push({
        key: `${kind}${i}`,
        x: Math.round(rnd() * SCENE_W),
        kind,
        from: Math.round(between(GROUND_SPANS[kind].from) * 10) / 10,
        until: Math.round(between(GROUND_SPANS[kind].until) * 10) / 10,
        size: 0.7 + rnd() * 0.6,
      });
    }
  }
  return { seed, trees, snags, ground };
}

/** Illustration height of a tree at a given year (drawing units), 0 before it establishes. */
export function treeHeight(t: PlannedTree, year: number): number {
  const age = year - t.establishYear;
  if (age <= 0) return 0;
  const g = SPECIES[t.species].growth;
  const scale = t.depth === 1 ? 0.62 : 1;
  return g.hMax * t.vigor * scale * Math.pow(1 - Math.exp(-g.k * age), g.p);
}

/** 1 → 0 over a year around an event, for fading things in and out. */
const fade = (year: number, at: number, width = 1) =>
  Math.max(0, Math.min(1, (at + width / 2 - year) / width));

export interface SceneTree extends PlannedTree {
  height: number;
  /** 0–1: fades out around the year the tree dies. */
  opacity: number;
}

export interface SceneSnag extends PlannedSnag {
  /** 0 standing … 1 lying on the ground. */
  fallen: number;
}

export interface Scene {
  year: number;
  trees: SceneTree[];
  snags: SceneSnag[];
  ground: (Plan['ground'][number] & { amount: number })[];
  /** Exposed ash and mineral soil, 1 right after the fire → 0. */
  ash: number;
}

/** The scene at a (possibly fractional) year since the fire. */
export function sceneAt(plan: Plan, year: number): Scene {
  const y = Math.max(0, Math.min(MAX_YEAR, year));
  const trees = plan.trees
    .map((t) => ({
      ...t,
      height: treeHeight(t, y),
      opacity: t.diesAt === null ? 1 : fade(y, t.diesAt),
    }))
    .filter((t) => t.height > 0.5 && t.opacity > 0);
  const snags = plan.snags.map((s) => ({
    ...s,
    fallen: Math.max(0, Math.min(1, (y - s.fallsAt) / 0.8)),
  }));
  const ground = plan.ground
    .map((g) => ({
      ...g,
      amount: Math.min(Math.max(0, (y - g.from) / 1.2), 1) * fade(y, g.until, 2),
    }))
    .filter((g) => g.amount > 0);
  return { year: y, trees, snags, ground, ash: Math.max(0, 1 - y / 6) };
}

export interface Stage {
  from: number;
  to: number;
  title: string;
  text: string;
}

/** Illustrative stages (from the plan); not universal biological milestones. */
export const STAGES: Stage[] = [
  {
    from: 0,
    to: 0.99,
    title: 'Burned ground',
    text: 'Standing charred trunks, ash and exposed mineral soil. Seed from sealed cones and roots that survived underground are the starting point.',
  },
  {
    from: 1,
    to: 3.99,
    title: 'First green',
    text: 'Fireweed and grasses cover the ash. Aspen sprouts from roots; the first pine and spruce seedlings appear.',
  },
  {
    from: 4,
    to: 9.99,
    title: 'Young stand',
    text: 'Saplings and low shrubs fill in. Dead trunks begin to fall. The ground looks green from above while the trees are still short.',
  },
  {
    from: 10,
    to: 19.99,
    title: 'Canopy forming',
    text: 'Broadleaf trees lead in height; conifers keep rising beneath them. Weaker stems drop out as crowns close.',
  },
  {
    from: 20,
    to: MAX_YEAR,
    title: 'Developing forest',
    text: 'Taller conifers start to reach the broadleaf crowns, with gaps where trees have died. Moss and needle litter carpet the floor.',
  },
];

export const stageAt = (year: number) =>
  STAGES.find((s) => year >= s.from && year <= s.to) ?? STAGES.at(-1)!;
