import { useRef } from 'react';
import { cn } from '@/lib/utils';
import { orthographic } from '@/domain/globe/sphere';
import { graticuleLines, lambert, parallel } from '@/components/graphics/globe';
import { drawLimb, traceVisible } from '@/components/graphics/globeCanvas';
import { cssVar, useCanvasRenderer } from '@/components/graphics/useCanvasRenderer';
import { GEDI_LIMIT_LAT } from '@/data/missions';

type BBox = [number, number, number, number];

const GRATICULE = graticuleLines(6);
const GEDI_LIMIT = parallel(GEDI_LIMIT_LAT);

/**
 * Small locator globe for the region view, in the landing globe's style: a
 * wireframe sphere with lit land dots (Natural Earth). The study area and the
 * GEDI coverage limit are drawn at their true coordinates. Static.
 */
export function DottedGlobe({
  dots,
  bbox,
  className,
  label,
}: {
  dots: [number, number][] | null;
  bbox: BBox;
  className?: string;
  label: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const target: [number, number] = [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2];

  useCanvasRenderer(
    ref,
    ({ ctx, w, h }) => {
      const el = ref.current;
      if (!el) return;
      const mint = cssVar(el, '--mint', '#9fd5c8');
      const silver = cssVar(el, '--silver', '#c8cdd2');
      const milky = cssVar(el, '--foreground', '#f1ede6');
      const burn = cssVar(el, '--burn', '#b53e5d');

      const R = Math.min(w, h) * 0.44;
      const cx = w / 2;
      const cy = h / 2;
      const P = (lon: number, lat: number) => {
        const p = orthographic(lon, lat, target[0] + 14, 30);
        return { x: cx + p.x * R, y: cy + p.y * R, nx: p.x, ny: p.y, z: p.z };
      };

      ctx.fillStyle = cssVar(el, '--background', '#0b0b0e');
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();

      // Wireframe.
      ctx.strokeStyle = silver;
      ctx.lineWidth = 0.5;
      ctx.globalAlpha = 0.2;
      ctx.beginPath();
      for (const line of GRATICULE) traceVisible(ctx, P, line);
      ctx.stroke();

      // Land, lit from the upper left; small squares so the continents stay readable.
      if (dots) {
        ctx.fillStyle = mint;
        const s = R / 300;
        for (const [lon, lat] of dots) {
          const p = P(lon, lat);
          if (p.z <= 0.02) continue;
          ctx.globalAlpha = Math.min(1, 0.22 + 0.9 * Math.pow(lambert(p.nx, p.ny, p.z), 1.35));
          const r = Math.max(0.35, (1.1 + 1.6 * p.z) * s);
          ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
        }
      }

      ctx.globalAlpha = 1;
      drawLimb(ctx, cx, cy, R, mint, { alphas: [0.8, 0.15, 0.06], width: 1 });

      // GEDI coverage limit: a real latitude circle.
      ctx.strokeStyle = milky;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.3;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      traceVisible(ctx, P, GEDI_LIMIT);
      ctx.stroke();
      ctx.setLineDash([]);

      // Study area: a ring with a burgundy core, as on the landing.
      const m = P(target[0], target[1]);
      if (m.z > 0) {
        ctx.globalAlpha = 1;
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        ctx.arc(m.x, m.y, 5.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = burn;
        ctx.beginPath();
        ctx.arc(m.x, m.y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    },
    { animate: false, deps: [dots, bbox[0], bbox[1], bbox[2], bbox[3]] },
  );

  return (
    <canvas
      ref={ref}
      role="img"
      aria-label={label}
      className={cn('block h-full w-full', className)}
    />
  );
}
