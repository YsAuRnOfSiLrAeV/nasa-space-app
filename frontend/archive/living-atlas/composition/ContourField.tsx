import { useRef } from 'react';
import { cn } from '@/lib/utils';
import { cssVar, useCanvasRenderer } from '@/components/graphics/useCanvasRenderer';

/** Two "hills" placed relative to the box: [x, y, rings, scale]. */
const HILLS = [
  [0.86, 0.18, 13, 1],
  [0.08, 1.05, 9, 0.85],
] as const;

/**
 * Decorative topographic contours (moodboard p09). Ornament only: drawn inside
 * panels, never on the map, so it cannot be read as elevation data. Drifts
 * slowly; static when the user prefers reduced motion.
 */
export function ContourField({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useCanvasRenderer(
    ref,
    ({ ctx, w, h, t }) => {
      const el = ref.current;
      if (!el) return;
      ctx.strokeStyle = cssVar(el, '--foreground', '#eef1e4');
      ctx.lineJoin = 'round';
      const step = Math.max(w, h) * 0.034;
      HILLS.forEach(([hx, hy, rings, scale], hi) => {
        for (let k = 1; k <= rings; k++) {
          const base = k * step * scale;
          ctx.beginPath();
          for (let s = 0; s <= 120; s++) {
            const a = (s / 120) * Math.PI * 2;
            const n =
              0.13 * Math.sin(2 * a + 0.7 + hi) +
              0.07 * Math.sin(3 * a + k * 0.35 + t * 0.18) +
              0.04 * Math.sin(5 * a - k * 0.3 + 1.3 - t * 0.12);
            const r = base * (1 + n);
            const x = hx * w + Math.cos(a) * r * 1.3;
            const y = hy * h + Math.sin(a) * r * 0.85;
            if (s === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          const index = k % 4 === 0;
          ctx.globalAlpha = index ? 0.2 : 0.08;
          ctx.lineWidth = index ? 1.1 : 0.75;
          ctx.stroke();
        }
      });
      ctx.globalAlpha = 1;
    },
    { animate: true },
  );

  return (
    <canvas
      ref={ref}
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 h-full w-full', className)}
    />
  );
}
