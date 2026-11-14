import { useLayoutEffect, type RefObject } from 'react';
import { measureInsets } from '@/components/map/measureInsets';

/**
 * Publishes how much of the map each edge is covered by the active composition
 * (`--occluded-top|right|bottom|left` in px on the scope element), so map controls
 * and overlays stay in the visible viewport for any theme and screen size.
 */
export function useOccludedInsets(scopeRef: RefObject<HTMLElement | null>, deps: unknown[]) {
  useLayoutEffect(() => {
    const scope = scopeRef.current;
    if (!scope) return;

    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const i = measureInsets(scope);
        scope.style.setProperty('--occluded-top', `${i.top}px`);
        scope.style.setProperty('--occluded-right', `${i.right}px`);
        scope.style.setProperty('--occluded-bottom', `${i.bottom}px`);
        scope.style.setProperty('--occluded-left', `${i.left}px`);
      });
    };

    const ro = new ResizeObserver(update);
    ro.observe(scope);
    scope.querySelectorAll('[data-map-occluder]').forEach((el) => ro.observe(el));
    update();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run when the composition changes
  }, deps);
}
