import { useEffect, useRef, type RefObject } from 'react';
import { usePageActive } from '@/app/pageActive';
import { usePrefersReducedMotion } from '@/hooks/useMediaQuery';

export interface CanvasFrame {
  ctx: CanvasRenderingContext2D;
  /** CSS pixel size of the canvas. */
  w: number;
  h: number;
  /** Seconds since the renderer started; frozen at 0 when motion is reduced. */
  t: number;
  /** True when the user prefers reduced motion: draw a meaningful static pose. */
  still: boolean;
}

/**
 * Drives one 2D canvas. Handles device pixel ratio (capped at 2), resizing,
 * and cleanup. Animates only when asked to, the user allows motion, the canvas
 * is on screen, its page is not covered and the tab is visible; otherwise it draws a single frame
 * whenever something changes (size, inputs, fonts loaded).
 *
 * `draw` may change every render; pass anything it depends on in `deps` so a
 * static canvas repaints when its inputs change.
 */
export function useCanvasRenderer(
  ref: RefObject<HTMLCanvasElement | null>,
  draw: (frame: CanvasFrame) => void,
  { animate, deps = [] }: { animate: boolean; deps?: unknown[] },
) {
  const reduced = usePrefersReducedMotion();
  // A page covered by another one holds still (its last frame stays drawn).
  const pageActive = usePageActive();
  const shouldAnimate = animate && pageActive;
  const drawRef = useRef(draw);
  const paintRef = useRef<() => void>(() => {});

  useEffect(() => {
    drawRef.current = draw;
  });

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const t0 = performance.now();
    let raf = 0;
    let onScreen = true;
    let disposed = false;
    const moving = () =>
      shouldAnimate && !reduced && onScreen && document.visibilityState === 'visible';

    const paint = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!w || !h) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = Math.round(w * dpr);
      const H = Math.round(h * dpr);
      if (canvas.width !== W || canvas.height !== H) {
        canvas.width = W;
        canvas.height = H;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const still = reduced || !animate;
      drawRef.current({ ctx, w, h, t: still ? 0 : (performance.now() - t0) / 1000, still });
    };

    const loop = () => {
      paint();
      raf = moving() ? requestAnimationFrame(loop) : 0;
    };
    const kick = () => {
      if (disposed) return;
      if (moving()) {
        if (!raf) raf = requestAnimationFrame(loop);
      } else {
        cancelAnimationFrame(raf);
        raf = 0;
        paint();
      }
    };
    paintRef.current = () => {
      if (!raf) paint();
    };

    const ro = new ResizeObserver(() => {
      if (!raf) paint();
    });
    ro.observe(canvas);
    const io = new IntersectionObserver(([entry]) => {
      onScreen = entry?.isIntersecting ?? true;
      kick();
    });
    io.observe(canvas);
    document.addEventListener('visibilitychange', kick);
    // Canvas text uses web fonts; repaint once they are available.
    document.fonts?.ready.then(() => {
      if (!disposed && !raf) paint();
    });
    kick();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', kick);
      paintRef.current = () => {};
    };
  }, [ref, animate, shouldAnimate, reduced]);

  // Static canvases repaint when their inputs change.
  useEffect(() => {
    paintRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller-provided inputs
  }, deps);
}

/** `#rrggbb` + alpha → `rgba()`, for canvas gradients (other formats → transparent). */
export function withAlpha(hex: string, a: number): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) return 'transparent';
  return `rgba(${parseInt(m[1]!, 16)}, ${parseInt(m[2]!, 16)}, ${parseInt(m[3]!, 16)}, ${a})`;
}

/** Read a CSS custom property from an element (theme colours and families for canvas). */
export function cssVar(el: Element, name: string, fallback: string): string {
  return getComputedStyle(el).getPropertyValue(name).trim() || fallback;
}
