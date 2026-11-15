import { describe, expect, it } from 'vitest';
import {
  changeMapMode,
  INITIAL_MAP_STATE,
  mapHref,
  mapStateOf,
  parseRoute,
  type MapState,
} from './route';

describe('unified map URL state', () => {
  it('opens the unchanged intro at the root and accepts direct fire links on first load', () => {
    expect(mapStateOf(parseRoute('#/'))).toEqual(INITIAL_MAP_STATE);
    expect(mapStateOf(parseRoute('#/?mode=examples&fire=bc_2003_490'))).toEqual({
      mode: 'examples',
      presentation: 'fire',
      fireId: 'bc_2003_490',
    });
  });
  it('round-trips modes, presentations and encoded fire identifiers', () => {
    for (const mode of ['examples', 'find-your-fire'] as const) {
      for (const presentation of ['intro', 'explore', 'fire'] as const) {
        const state: MapState = {
          mode,
          presentation,
          fireId: presentation === 'fire' ? 'a b/é?&' : null,
        };
        expect(mapStateOf(parseRoute(mapHref(state)))).toEqual(
          presentation === 'intro' ? INITIAL_MAP_STATE : state,
        );
      }
    }
  });
  it('clears active selection on a workflow change without storing or changing camera state', () => {
    const selected: MapState = { mode: 'examples', presentation: 'fire', fireId: 'bc_2003_490' };
    expect(changeMapMode(selected, 'find-your-fire')).toEqual({
      mode: 'find-your-fire',
      presentation: 'explore',
      fireId: null,
    });
    expect(changeMapMode(selected, 'examples')).toBe(selected);
    expect(changeMapMode(INITIAL_MAP_STATE, 'find-your-fire')).toEqual({
      mode: 'find-your-fire',
      presentation: 'explore',
      fireId: null,
      draw: true,
    });
    expect(selected.fireId).toBe('bc_2003_490');
  });
  it('normalizes incomplete and unknown query values deterministically', () => {
    expect(mapStateOf(parseRoute('#/?view=fire&mode=invalid'))).toEqual({
      mode: 'examples',
      presentation: 'explore',
      fireId: null,
    });
    expect(mapStateOf(parseRoute('#/?view=invalid&mode=search'))).toEqual({
      mode: 'find-your-fire',
      presentation: 'intro',
      fireId: null,
    });
    expect(mapStateOf(parseRoute('#/?view=intro&fire=x'))?.presentation).toBe('fire');
  });
  it('keeps legacy fire and analysis URLs in Map while retaining all research routes', () => {
    expect(mapStateOf(parseRoute('#/fire/bc_2003_490'))).toEqual({
      mode: 'examples',
      presentation: 'fire',
      fireId: 'bc_2003_490',
    });
    expect(mapStateOf(parseRoute('#/analyze'))).toEqual({
      mode: 'find-your-fire',
      presentation: 'explore',
      fireId: null,
    });
    for (const url of [
      '#/research',
      '#/research/recovery/x',
      '#/recovery/x/growth',
      '#/research/forest-3d',
    ]) {
      expect(mapStateOf(parseRoute(url))).toBeNull();
    }
    expect(parseRoute('#/research?mode=search')).toEqual({ page: 'research' });
  });
});
