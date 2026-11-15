import { describe, expect, it } from 'vitest';
import { illustrativeComposition } from './composition';
import { MAX_YEAR, STAGES, TREE_COUNT, planForest, sceneAt, stageAt, treeHeight } from './growth';
import { SPECIES } from './species';

const conifer = [
  { code: 1, label: 'Evergreen needleleaf forest', n: 28 },
  { code: 8, label: 'Woody savanna', n: 2 },
];

describe('illustrative composition', () => {
  it('weights regional mixes by the group’s pre-fire classes and sums to 1', () => {
    const c = illustrativeComposition(conifer);
    expect(c.shares.reduce((s, x) => s + x.share, 0)).toBeCloseTo(1, 2);
    expect(c.shares[0]!.id).toBe('jack-pine');
    expect(c.shares.some((s) => s.id === 'tamarack')).toBe(false);
    expect(c.basis).toMatch(/28 of 30 evergreen needleleaf forest/);
    expect(c.basis).toMatch(/Not a species inventory/);
  });

  it('only draws tamarack where the pre-fire class was wetland', () => {
    const wet = illustrativeComposition([{ code: 11, label: 'Permanent wetland', n: 3 }]);
    expect(wet.shares.map((s) => s.id).sort()).toEqual(['black-spruce', 'tamarack']);
  });
});

describe('forest plan and scenes', () => {
  const shares = illustrativeComposition(conifer).shares;
  const plan = planForest('2002_205_-376', shares);

  it('is deterministic: same group, same plan; another group, another plan', () => {
    expect(planForest('2002_205_-376', shares)).toEqual(plan);
    expect(planForest('2011_204_-379', shares).trees.map((t) => t.x)).not.toEqual(
      plan.trees.map((t) => t.x),
    );
  });

  it('allocates exactly the tree count, following the shares', () => {
    expect(plan.trees).toHaveLength(TREE_COUNT);
    for (const s of shares) {
      const n = plan.trees.filter((t) => t.species === s.id).length;
      expect(Math.abs(n - s.share * TREE_COUNT), s.id).toBeLessThanOrEqual(1);
    }
  });

  it('renders the same scene for the same year', () => {
    expect(sceneAt(plan, 12)).toEqual(sceneAt(plan, 12));
  });

  it('starts as burned ground: no live trees, all snags standing, full ash', () => {
    const s = sceneAt(plan, 0);
    expect(s.trees).toHaveLength(0);
    expect(s.snags.every((x) => x.fallen === 0)).toBe(true);
    expect(s.ash).toBe(1);
  });

  it('grows continuously and never shrinks a living tree', () => {
    for (const t of plan.trees) {
      let prev = 0;
      for (let y = 0; y <= MAX_YEAR; y += 0.25) {
        const h = treeHeight(t, y);
        expect(h).toBeGreaterThanOrEqual(prev);
        prev = h;
      }
    }
  });

  it('shows aspen ahead of black spruce early, as their regeneration traits say', () => {
    const mean = (sp: string, y: number) => {
      const ts = plan.trees.filter((t) => t.species === sp && t.depth === 0);
      return ts.reduce((s, t) => s + treeHeight(t, y), 0) / Math.max(1, ts.length);
    };
    expect(mean('trembling-aspen', 8)).toBeGreaterThan(mean('black-spruce', 8));
  });

  it('lets snags fall and ash disappear over time', () => {
    const late = sceneAt(plan, MAX_YEAR);
    expect(late.snags.every((x) => x.fallen === 1)).toBe(true);
    expect(late.ash).toBe(0);
  });

  it('covers every year 0–30 with exactly one illustrative stage', () => {
    for (let y = 0; y <= MAX_YEAR; y += 0.5) {
      expect(
        STAGES.filter((s) => y >= s.from && y <= s.to),
        String(y),
      ).toHaveLength(1);
    }
    expect(stageAt(0).title).toBe('Burned ground');
  });

  it('has growth parameters for every species', () => {
    for (const sp of Object.values(SPECIES)) {
      expect(sp.establish[0]).toBeLessThanOrEqual(sp.establish[1]);
      expect(sp.growth.hMax).toBeGreaterThan(0);
    }
  });
});
