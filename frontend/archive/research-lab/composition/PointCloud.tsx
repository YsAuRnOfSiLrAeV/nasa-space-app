import { useMemo, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { LocatedPoint } from '@/data/schema';
import { buildCloud, countAtOrAbove, sweepHeight } from '@/components/graphics/pointCloud';
import { cssVar, useCanvasRenderer } from '@/components/graphics/useCanvasRenderer';
import styles from './ResearchLab.module.css';

/** Vertical size of the tallest footprint relative to the ground half-extent. */
const HEIGHT_SCALE = 0.7;
/** Static pose (reduced motion): plane parked on the 10 m stage break. */
const STILL_PLANE_M = 10;

/**
 * Point-cloud view of the real samples (moodboard p02): every GEDI footprint at
 * its true position, drawn as a column of returns up to its measured rh98.
 * A reading plane sweeps through the canopy and reports how many footprints
 * reach it, computed from the data on every frame. Rotation and sweep are
 * display only, not a live scan.
 */
export function PointCloud({
  located,
  className,
}: {
  located: LocatedPoint[];
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const planeRef = useRef<HTMLSpanElement>(null);
  const cloud = useMemo(() => buildCloud(located), [located]);
  const total = cloud.pts.length;

  useCanvasRenderer(
    canvasRef,
    ({ ctx, w, h, t, still }) => {
      const el = canvasRef.current;
      if (!el || total === 0) return;
      const fg = cssVar(el, '--foreground', '#f2eee8');
      const amber = cssVar(el, '--amber', '#e8a33d');
      const muted = cssVar(el, '--muted-foreground', '#8a8a8a');

      const a = -0.6 + (still ? 0 : t * 0.08);
      const e = 0.42;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const ce = Math.cos(e);
      const se = Math.sin(e);
      const S = Math.min(w * 0.4, h * 0.62);
      const cx = w / 2;
      const cy = h * 0.66;
      const D = 3.4;
      const project = (x: number, y: number, z: number) => {
        const X = x * ca - z * sa;
        const Z = x * sa + z * ca;
        const yv = y * ce + Z * se;
        const zv = Z * ce - y * se;
        const k = D / (D + zv);
        return [cx + X * S * k, cy - yv * S * k] as const;
      };
      const yOf = (m: number) => (m / cloud.maxHeightM) * HEIGHT_SCALE;

      // Ground frame with a quarter grid.
      const frame = (y: number) => {
        const c = [
          project(-cloud.ex, y, -cloud.ez),
          project(cloud.ex, y, -cloud.ez),
          project(cloud.ex, y, cloud.ez),
          project(-cloud.ex, y, cloud.ez),
        ];
        ctx.beginPath();
        c.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
        ctx.closePath();
      };
      ctx.lineWidth = 1;
      ctx.strokeStyle = fg;
      ctx.globalAlpha = 0.08;
      for (let i = 1; i < 4; i++) {
        const fx = -cloud.ex + (i * cloud.ex) / 2;
        const fz = -cloud.ez + (i * cloud.ez) / 2;
        let [x0, y0] = project(fx, 0, -cloud.ez);
        let [x1, y1] = project(fx, 0, cloud.ez);
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        [x0, y0] = project(-cloud.ex, 0, fz);
        [x1, y1] = project(cloud.ex, 0, fz);
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      }
      ctx.globalAlpha = 0.35;
      frame(0);
      ctx.stroke();

      // Reading plane.
      const plane = still ? STILL_PLANE_M : sweepHeight(t, cloud.maxHeightM);
      const py = yOf(plane);
      ctx.setLineDash([2, 4]);
      ctx.strokeStyle = amber;
      ctx.globalAlpha = 0.6;
      frame(py);
      ctx.stroke();
      ctx.setLineDash([]);

      // Columns of returns, ground → measured canopy top.
      const band = cloud.maxHeightM / 60;
      for (const p of cloud.pts) {
        const top = yOf(p.heightM);
        ctx.fillStyle = fg;
        for (let m = 0; m < p.heightM; m += 1) {
          const [sx, sy] = project(p.x, yOf(m), p.z);
          ctx.globalAlpha = 0.05 + 0.18 * (m / cloud.maxHeightM);
          ctx.fillRect(sx, sy, 1, 1);
        }
        const [tx, ty] = project(p.x, top, p.z);
        const reaches = p.heightM >= plane;
        ctx.fillStyle = reaches ? fg : muted;
        ctx.globalAlpha = reaches ? 0.95 : 0.45;
        const s = p.burned ? 2 : 1.6;
        ctx.fillRect(tx - s / 2, ty - s / 2, s, s);
        // Where a column crosses the plane, mark the intersection.
        if (reaches && p.heightM - plane < band * 6) {
          const [ix, iy] = project(p.x, py, p.z);
          ctx.fillStyle = amber;
          ctx.globalAlpha = 0.9;
          ctx.fillRect(ix - 1, iy - 1, 2, 2);
        }
      }
      ctx.globalAlpha = 1;

      if (planeRef.current) {
        planeRef.current.textContent = `Plane ${plane.toFixed(1)} m · ${countAtOrAbove(cloud.pts, plane)}/${total}`;
      }
    },
    { animate: true, deps: [cloud] },
  );

  return (
    <figure className={cn(styles.module, 'flex flex-col gap-2', className)}>
      <span className={styles.corners} aria-hidden />
      <figcaption className="flex items-center gap-2.5">
        <span className={styles.index} aria-hidden>
          D
        </span>
        <span className={styles.label} style={{ color: 'var(--foreground)' }}>
          Point cloud
        </span>
        <span className={cn(styles.label, 'ml-auto')}>{total} footprints · rh98</span>
      </figcaption>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`Point cloud of ${total} GEDI footprints at their true positions, each drawn up to its measured canopy height. Rotation and the moving height plane are display only.`}
        className="h-48 w-full"
      />
      <div className={cn(styles.label, 'flex items-center justify-between gap-3')}>
        <span ref={planeRef} aria-hidden className="text-amber" />
        <span className="type-coord">
          {cloud.lonSpan.toFixed(2)}° × {cloud.latSpan.toFixed(2)}°
        </span>
      </div>
      <p className={cn(styles.label, 'tracking-[0.14em] text-(--faint)')}>
        Count = footprints reaching the plane · vertical exaggerated · motion is display only
      </p>
    </figure>
  );
}
