import { describe, expect, it } from 'vitest';
import {
  ANALYZE_HREF,
  EXPLORE_HREF,
  FOREST_3D_HREF,
  RESEARCH_HREF,
  canonicalHash,
  fireHref,
  parseRoute,
  recoveryHref,
  sectionOf,
  mapStateOf,
} from './route';

describe('hash routes', () => {
  it('treats empty, root and unknown hashes as the explorer', () => {
    for (const h of ['', '#', '#/', '#/nope', '#/region']) {
      expect(parseRoute(h), h).toEqual({ page: 'explore' });
    }
  });

  it('reads the three primary routes from their own links', () => {
    expect(parseRoute(EXPLORE_HREF)).toEqual({ page: 'explore' });
    expect(parseRoute(RESEARCH_HREF)).toEqual({ page: 'research' });
    expect(parseRoute(ANALYZE_HREF)).toEqual({ page: 'analyze' });
  });

  it('opens the 3D forest illustration under Research', () => {
    expect(parseRoute(FOREST_3D_HREF)).toEqual({ page: 'forest3d' });
    expect(parseRoute(`${FOREST_3D_HREF}/`)).toEqual({ page: 'forest3d' });
    expect(sectionOf({ page: 'forest3d' })).toBe('research');
  });

  it('tolerates trailing slashes and unknown sub-paths of the primary routes', () => {
    expect(parseRoute('#/research/')).toEqual({ page: 'research' });
    expect(parseRoute('#/research/unknown')).toEqual({ page: 'research' });
    expect(parseRoute('#/analyze/')).toEqual({ page: 'analyze' });
    expect(parseRoute('#/analyze/anything')).toEqual({ page: 'analyze' });
  });

  it('reads the fire detail route, and falls back to the explorer without an id', () => {
    expect(parseRoute('#/fire/bc_2003_490')).toEqual({ page: 'fire', fireId: 'bc_2003_490' });
    expect(parseRoute('#/fire/bc_2003_490/')).toEqual({ page: 'fire', fireId: 'bc_2003_490' });
    expect(parseRoute('#/fire')).toEqual({ page: 'explore' });
    expect(parseRoute('#/fire/')).toEqual({ page: 'explore' });
  });

  it('round-trips fire ids through the link builder', () => {
    for (const id of ['bc_2003_490', 'a b/c', 'ü%']) {
      expect(mapStateOf(parseRoute(fireHref(id)))).toEqual({
        mode: 'examples',
        presentation: 'fire',
        fireId: id,
      });
    }
  });

  it('reads the recovery page with and without a group', () => {
    expect(parseRoute('#/research/recovery')).toEqual({
      page: 'recovery',
      groupId: null,
      view: 'observed',
    });
    expect(parseRoute('#/research/recovery/')).toEqual({
      page: 'recovery',
      groupId: null,
      view: 'observed',
    });
    expect(parseRoute('#/research/recovery/2002_205_-376')).toEqual({
      page: 'recovery',
      groupId: '2002_205_-376',
      view: 'observed',
    });
  });

  it('reads the growth view, and ignores unknown views', () => {
    expect(parseRoute('#/research/recovery/2002_205_-376/growth')).toEqual({
      page: 'recovery',
      groupId: '2002_205_-376',
      view: 'growth',
    });
    expect(parseRoute('#/research/recovery/2002_205_-376/other')).toMatchObject({
      view: 'observed',
    });
  });

  it('round-trips group ids and views through the link builder', () => {
    for (const id of ['2002_205_-376', 'a b/c', 'ü%']) {
      expect(parseRoute(recoveryHref(id))).toEqual({
        page: 'recovery',
        groupId: id,
        view: 'observed',
      });
      expect(parseRoute(recoveryHref(id, 'growth'))).toEqual({
        page: 'recovery',
        groupId: id,
        view: 'growth',
      });
    }
    expect(recoveryHref(null)).toBe('#/research/recovery');
    expect(parseRoute(recoveryHref(null, 'growth'))).toEqual({
      page: 'recovery',
      groupId: null,
      view: 'growth',
    });
  });

  it('maps every route to its navigation section', () => {
    expect(sectionOf(parseRoute('#/'))).toBe('explore');
    expect(sectionOf(parseRoute('#/fire/bc_2003_490'))).toBe('explore');
    expect(sectionOf(parseRoute('#/research'))).toBe('research');
    expect(sectionOf(parseRoute('#/research/recovery/2002_205_-376'))).toBe('research');
    expect(sectionOf(parseRoute('#/analyze'))).toBe('analyze');
  });
});

describe('legacy recovery links', () => {
  const LEGACY: [string, string][] = [
    ['#/recovery', '#/research/recovery'],
    ['#/recovery/', '#/research/recovery'],
    ['#/recovery/2002_205_-376', '#/research/recovery/2002_205_-376'],
    ['#/recovery/2002_205_-376/growth', '#/research/recovery/2002_205_-376/growth'],
    ['#/recovery/-/growth', '#/research/recovery/-/growth'],
    ['#/recovery/a%20b%2Fc', '#/research/recovery/a%20b%2Fc'],
  ];

  it('still open the Recovery page', () => {
    expect(parseRoute('#/recovery')).toEqual({ page: 'recovery', groupId: null, view: 'observed' });
    expect(parseRoute('#/recovery/2002_205_-376/growth')).toEqual({
      page: 'recovery',
      groupId: '2002_205_-376',
      view: 'growth',
    });
  });

  it('redirect to the matching Research address, which opens the same page', () => {
    for (const [legacy, current] of LEGACY) {
      expect(canonicalHash(legacy), legacy).toBe(current);
      expect(parseRoute(current), legacy).toEqual(parseRoute(legacy));
    }
  });

  it('leave current addresses alone', () => {
    for (const h of ['', '#/', '#/research', '#/research/recovery/x', '#/analyze', '#/fire/x']) {
      expect(canonicalHash(h), h).toBeNull();
    }
  });
});
