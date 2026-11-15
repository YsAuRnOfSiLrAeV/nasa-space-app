import { SiteNav } from '@/components/shell/SiteNav';
import type { EarthView } from './useEarthView';

/**
 * The explorer's header: the three primary sections only. Sources lives with
 * the evidence: in the landing's footer and in the region view. Explore (and the
 * brand) return to the planet view; the region is entered from its own action.
 */
export function EarthHeader({ view }: { view: Pick<EarthView, 'phase' | 'goPlanet'> }) {
  return (
    <header data-map-occluder="top" className="pointer-events-none absolute inset-x-0 top-0 z-30">
      <SiteNav current="explore" fade={view.phase !== 'planet'} onExplore={view.goPlanet} />
    </header>
  );
}
