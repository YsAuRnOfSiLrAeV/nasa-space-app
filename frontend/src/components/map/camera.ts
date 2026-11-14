import type { PaddingOptions } from 'maplibre-gl';
import { measureInsets } from './measureInsets';

/** Padding that keeps a target clear of whatever the active theme puts over the map. */
export function visiblePadding(container: HTMLElement, gap = 40): PaddingOptions {
  const i = measureInsets(container);
  const c = container.getBoundingClientRect();
  const pad = {
    top: i.top + gap,
    right: i.right + gap,
    bottom: i.bottom + gap,
    left: i.left + gap,
  };
  // Never squeeze the view below a usable size (e.g. phones with a bottom sheet).
  if (c.width - pad.left - pad.right < 120) pad.left = pad.right = gap;
  if (c.height - pad.top - pad.bottom < 120) pad.top = pad.bottom = gap;
  return pad;
}
