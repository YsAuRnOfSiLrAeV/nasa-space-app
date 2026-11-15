/**
 * Hash routes (no router library). Map and Research are the two primary pages.
 * Map query parameters store presentation, workflow and selected fire, never camera state.
 *
 *   Explore
 *     #/                                      → unchanged intro composition
 *     #/explore?mode=examples                 → fire browsing
 *     #/explore?mode=find-your-fire           → search and drawing
 *     #/explore?mode=examples&fire=<id>        → existing fire result
 *     #/?view=fire&mode=examples&fire=<id>     → supported legacy fire link
 *     #/fire/<fire id>                         → legacy selected fire
 *   Research
 *     #/research                              → research and methodology
 *     #/research/recovery/<group id>          → Forest Recovery, observed evidence
 *     #/research/recovery/<group id>/growth   → Forest Recovery, illustrated growth
 *     #/research/forest-3d                    → 3D forest structure (conceptual illustration)
 *     #/analyze                               → legacy Find Your Fire mode
 *
 * Legacy `#/recovery/...` links still open the Recovery page; `canonicalHash`
 * gives their current address so the URL bar can be corrected.
 */
export type RecoveryView = 'observed' | 'growth';

export type Section = 'explore' | 'research' | 'analyze';

export type ExplorerMode = 'examples' | 'find-your-fire';
export type MapMode = ExplorerMode;
export type MapPresentation = 'intro' | 'explore' | 'fire';
export interface MapState {
  country?: string;
  mode: MapMode;
  presentation: MapPresentation;
  fireId: string | null;
  draw?: true;
}
export const INITIAL_MAP_STATE: MapState = {
  mode: 'examples',
  presentation: 'intro',
  fireId: null,
};

export type Route =
  | { page: 'explore'; map?: MapState }
  | { page: 'fire'; fireId: string }
  | { page: 'research' }
  | { page: 'recovery'; groupId: string | null; view: RecoveryView }
  | { page: 'forest3d' }
  | { page: 'analyze' };

export const EXPLORE_HREF = '#/';
export const RESEARCH_HREF = '#/research';
export const ANALYZE_HREF = '#/analyze';
export const FOREST_3D_HREF = `${RESEARCH_HREF}/forest-3d`;

const RECOVERY_BASE = `${RESEARCH_HREF}/recovery`;

export function fireHref(fireId: string): string {
  return mapHref({ mode: 'examples', presentation: 'fire', fireId });
}

/** URL state contains intent and selection, never a camera or an instruction to refit it. */
export function mapHref(state: MapState): string {
  const presentation = state.fireId
    ? 'fire'
    : state.presentation === 'fire'
      ? 'explore'
      : state.presentation;
  if (presentation === 'intro') return EXPLORE_HREF;
  const query = new URLSearchParams({ mode: state.mode });
  if (state.mode === 'find-your-fire' && state.country) query.set('country', state.country);
  if (state.mode === 'find-your-fire' && state.draw) query.set('draw', '1');
  if (presentation === 'fire' && state.fireId) query.set('fire', state.fireId);
  return `#/explore?${query}`;
}

export function mapStateOf(route: Route): MapState | null {
  if (route.page === 'explore') return route.map ?? INITIAL_MAP_STATE;
  if (route.page === 'fire')
    return { mode: 'examples', presentation: 'fire', fireId: route.fireId };
  if (route.page === 'analyze')
    return { mode: 'find-your-fire', presentation: 'explore', fireId: null };
  return null;
}

/** A different workflow clears active selection; cached data and cameras live outside this state. */
export function changeMapMode(state: MapState, mode: MapMode): MapState {
  if (mode === state.mode && state.presentation !== 'intro') return state;
  return {
    mode,
    presentation: 'explore',
    fireId: null,
    ...(mode === 'find-your-fire' && state.presentation === 'intro' ? { draw: true as const } : {}),
  };
}

export function recoveryHref(groupId?: string | null, view: RecoveryView = 'observed'): string {
  const base = groupId ? `${RECOVERY_BASE}/${encodeURIComponent(groupId)}` : RECOVERY_BASE;
  return view === 'growth' ? `${groupId ? base : `${base}/-`}/growth` : base;
}

/** The primary navigation section a route belongs to. */
export function sectionOf(route: Route): Section {
  switch (route.page) {
    case 'explore':
    case 'fire':
      return 'explore';
    case 'research':
    case 'recovery':
    case 'forest3d':
      return 'research';
    case 'analyze':
      return 'analyze';
  }
}

export function parseRoute(hash: string): Route {
  const [page, ...rest] = segments(hash);
  switch (page) {
    case 'fire': {
      const fireId = decode(rest[0]);
      return fireId ? { page: 'fire', fireId } : { page: 'explore' };
    }
    case 'research':
      if (rest[0] === 'recovery') return recoveryRoute(rest[1], rest[2]);
      if (rest[0] === 'forest-3d') return { page: 'forest3d' };
      return { page: 'research' };
    case 'recovery': // legacy address
      return recoveryRoute(rest[0], rest[1]);
    case 'analyze':
      return { page: 'analyze' };
    default:
      if (page === 'explore' || (!page && hash.includes('?'))) {
        const query = new URLSearchParams(
          hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '',
        );
        const fireId = query.get('fire')?.trim() || null;
        const view = query.get('view');
        return {
          page: 'explore',
          map: {
            mode: ['search', 'find-your-fire'].includes(query.get('mode') ?? '')
              ? 'find-your-fire'
              : 'examples',
            ...(['search', 'find-your-fire'].includes(query.get('mode') ?? '') &&
            query.get('draw') === '1'
              ? { draw: true as const }
              : {}),
            ...(query.get('country') ? { country: query.get('country')! } : {}),
            presentation: fireId
              ? 'fire'
              : page === 'explore' || view === 'explore' || view === 'fire'
                ? 'explore'
                : 'intro',
            fireId,
          },
        };
      }
      return { page: 'explore' };
  }
}

/**
 * The current address of a legacy hash (`#/recovery/...` → `#/research/recovery/...`),
 * or null when the hash is not a legacy one.
 */
export function canonicalHash(hash: string): string | null {
  const parts = segments(hash);
  return parts[0] === 'recovery' ? `${RESEARCH_HREF}/${parts.join('/')}` : null;
}

function segments(hash: string): string[] {
  return hash.split('?')[0]!.replace(/^#/, '').replace(/^\/+/, '').replace(/\/+$/, '').split('/');
}

function recoveryRoute(rawGroup: string | undefined, rawView: string | undefined): Route {
  const view: RecoveryView = rawView === 'growth' ? 'growth' : 'observed';
  const groupId = rawGroup === '-' ? null : decode(rawGroup);
  return { page: 'recovery', groupId, view };
}

/** A decoded path segment; null when empty, the raw text when it is not valid encoding. */
function decode(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
