/**
 * Theme compositions place UI over the full-bleed map (rails, columns, readout bars).
 * Any element marked `data-map-occluder` is measured so the map can keep the study
 * area, controls and overlays inside the visible viewport, whatever the layout.
 */
export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface Rect {
  top: number;
  right: number;
  bottom: number;
  left: number;
  /** Explicit edge (from `data-map-occluder="top"` etc.); otherwise inferred. */
  edge?: keyof Insets;
}

/** Edge tolerance in px: an element within this distance of an edge "touches" it. */
const EDGE = 24;

/**
 * Classify each rect (relative to a W×H viewport) by the edge it is attached to:
 * wide bars along the top/bottom, tall columns along the left/right.
 * Rects that touch no edge (floating cards) don't reserve space, unless they
 * name an edge explicitly (e.g. a title block that should keep the top clear).
 */
export function insetsFromRects(rects: Rect[], width: number, height: number): Insets {
  const out: Insets = { top: 0, right: 0, bottom: 0, left: 0 };
  for (const r of rects) {
    const w = r.right - r.left;
    const h = r.bottom - r.top;
    if (w <= 0 || h <= 0) continue;
    if (r.edge === 'top') out.top = Math.max(out.top, r.bottom);
    else if (r.edge === 'bottom') out.bottom = Math.max(out.bottom, height - r.top);
    else if (r.edge === 'left') out.left = Math.max(out.left, r.right);
    else if (r.edge === 'right') out.right = Math.max(out.right, width - r.left);
    if (r.edge) continue;
    const wide = w >= width * 0.6;
    if (wide && r.top <= EDGE) out.top = Math.max(out.top, r.bottom);
    else if (wide && r.bottom >= height - EDGE) out.bottom = Math.max(out.bottom, height - r.top);
    else if (r.left <= EDGE) out.left = Math.max(out.left, r.right);
    else if (r.right >= width - EDGE) out.right = Math.max(out.right, width - r.left);
  }
  return out;
}
