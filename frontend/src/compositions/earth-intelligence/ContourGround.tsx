import { useRef } from 'react';
import { cssVar, useCanvasRenderer } from '@/components/graphics/useCanvasRenderer';
import { traceContours } from './planet/contours';

/**
 * The landing's charcoal technical-paper ground: hairline contours, sparse in
 * the middle and gathering into relief along the lower edge and sides. Static
 * (repaints only on resize). Decorative, so hidden from assistive technology;
 * the figure index states it is not measured terrain.
 */
export function ContourGround({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useCanvasRenderer(
    ref,
    ({ ctx, w, h }) => {
      const el = ref.current;
      if (!el) return;
      const { minor, index } = traceContours(w, h);
      const stroke = (segs: number[], color: string, width: number) => {
        ctx.beginPath();
        for (let i = 0; i < segs.length; i += 4) {
          ctx.moveTo(segs[i]!, segs[i + 1]!);
          ctx.lineTo(segs[i + 2]!, segs[i + 3]!);
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.stroke();
      };
      stroke(minor, cssVar(el, '--cartography-contour', '#24272b'), 0.6);
      stroke(index, cssVar(el, '--cartography-contour-index', '#2f3337'), 0.9);
    },
    { animate: false },
  );
  return <canvas ref={ref} aria-hidden="true" className={className} />;
}
