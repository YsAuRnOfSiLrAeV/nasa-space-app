import { useRef } from 'react';
import { seededRandom } from '@/components/forest/growth';
import { cssVar, useCanvasRenderer } from '@/components/graphics/useCanvasRenderer';

/** Fixed stars (fractions of the stage), seeded so they never jump between loads. */
const STARS = (() => {
  const rnd = seededRandom(20260713);
  return Array.from({ length: 150 }, () => ({
    x: rnd(),
    y: rnd(),
    r: 0.35 + rnd() * 0.8,
    a: 0.1 + rnd() * 0.34,
  }));
})();

/** A still field of faint stars behind the globe, painted once (no animation loop). */
export function Starfield() {
  const ref = useRef<HTMLCanvasElement>(null);
  useCanvasRenderer(
    ref,
    ({ ctx, w, h }) => {
      const el = ref.current;
      if (!el) return;
      ctx.fillStyle = cssVar(el, '--foreground', '#f1ede6');
      for (const st of STARS) {
        ctx.globalAlpha = st.a;
        ctx.beginPath();
        ctx.arc(st.x * w, st.y * h, st.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    },
    { animate: false },
  );
  return <canvas ref={ref} aria-hidden className="absolute inset-0 h-full w-full" />;
}
