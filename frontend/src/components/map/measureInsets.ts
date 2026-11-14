import { insetsFromRects, type Insets, type Rect } from './occluders';

/** DOM side of occluders.ts: measure `[data-map-occluder]` elements inside the map scope. */
export function measureInsets(container: HTMLElement): Insets {
  const c = container.getBoundingClientRect();
  const scope = container.closest('[data-map-scope]') ?? document.body;
  const rects = [...scope.querySelectorAll<HTMLElement>('[data-map-occluder]')]
    .filter((el) => el.offsetParent !== null) // skip display:none
    .map((el): Rect => {
      const r = el.getBoundingClientRect();
      const hint = el.dataset.mapOccluder;
      const edge =
        hint === 'top' || hint === 'right' || hint === 'bottom' || hint === 'left'
          ? hint
          : undefined;
      return {
        edge,
        top: r.top - c.top,
        right: r.right - c.left,
        bottom: r.bottom - c.top,
        left: r.left - c.left,
      };
    });
  return insetsFromRects(rects, c.width, c.height);
}
