import type { ScreenBox } from './drawObservations';

interface BoundsSource {
  getBoundingClientRect(): { left: number; top: number; height: number };
}

/** Layout stays fixed while the globe animates. Invalidate only on layout changes. */
export function createLeaderLayout() {
  let cached: { ox: number; oy: number; fx: number; fy: number; height: number } | null = null;
  let measured = false;
  return {
    invalidate() {
      cached = null;
      measured = false;
    },
    path(
      mark: ScreenBox | null,
      stage: BoundsSource,
      canvas: BoundsSource,
      frame: BoundsSource & { offsetParent: object | null },
    ): string {
      if (!mark) return '';
      if (!measured) {
        measured = true;
        if (frame.offsetParent !== null) {
          const s = stage.getBoundingClientRect();
          const c = canvas.getBoundingClientRect();
          const f = frame.getBoundingClientRect();
          cached = {
            ox: c.left - s.left,
            oy: c.top - s.top,
            fx: f.left - s.left,
            fy: f.top - s.top,
            height: f.height,
          };
        }
      }
      if (!cached) return '';
      const { ox, oy, fx, fy, height } = cached;
      return (
        `M${ox + mark.x1} ${oy + mark.y0}L${fx} ${fy}` +
        `M${ox + mark.x1} ${oy + mark.y1}L${fx} ${fy + height}`
      );
    },
  };
}
