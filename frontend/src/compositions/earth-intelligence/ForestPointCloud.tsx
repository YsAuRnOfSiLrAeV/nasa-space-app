import { useMemo, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { LocatedPoint } from '@/data/schema';
import { buildCloud, countAtOrAbove, sweepHeight } from '@/components/graphics/pointCloud';
import { cssVar, useCanvasRenderer } from '@/components/graphics/useCanvasRenderer';
import type { BurnGroup } from '@/domain/study/burnGroups';
import primitives from '@/components/shell/primitives.module.css';
import styles from './EarthIntelligence.module.css';

/** Vertical size of the tallest footprint relative to the ground half-extent. */
const HEIGHT_SCALE = 0.7;
/** Static pose (reduced motion, or the view is hidden): plane on the 10 m stage break. */
const STILL_PLANE_M = 10;

/**
 * The forest as a slowly turning point cloud: every GEDI footprint at its true
 * position, drawn as a column of returns up to its measured canopy height
 * (rh98). A reading plane sweeps up through the canopy and counts the
 * footprints that reach it, computed from the data on every frame. The fire
 * year picked in the register is drawn in burgundy. Rotation and sweep are
 * display only, not a live scan.
 */
export function ForestPointCloud({
  located,
  focus,
  animate,
}: {
  located: LocatedPoint[];
  /** Burn-scar group to highlight, if one is picked. */
  focus: BurnGroup | null;
  /** False while the view is hidden: draw one still frame instead of animating. */
  animate: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const planeRef = useRef<HTMLSpanElement>(null);
  const cloud = useMemo(() => buildCloud(located), [located]);
  const total = cloud.pts.length;
  const focusId = focus?.id ?? null;

  useCanvasRenderer(
    canvasRef,
    ({ ctx, w, h, t, still }) => {
      const el = canvasRef.current;
      if (!el || total === 0) return;
      const fg = cssVar(el, '--foreground', '#e9eee9');
      const burn = cssVar(el, '--burn-text', '#e3667f');
      const select = cssVar(el, '--select', '#9073db');
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
      ctx.strokeStyle = select;
      ctx.globalAlpha = 0.6;
      frame(py);
      ctx.stroke();
      ctx.setLineDash([]);

      // Columns of returns, ground → measured canopy top. The picked group draws last, on top.
      const band = cloud.maxHeightM / 60;
      const drawPoint = (p: (typeof cloud.pts)[number], picked: boolean) => {
        const top = yOf(p.heightM);
        ctx.fillStyle = picked ? burn : fg;
        for (let m = 0; m < p.heightM; m += 1) {
          const [sx, sy] = project(p.x, yOf(m), p.z);
          ctx.globalAlpha = picked
            ? 0.25 + 0.5 * (m / cloud.maxHeightM)
            : 0.05 + 0.18 * (m / cloud.maxHeightM);
          ctx.fillRect(sx, sy, 1, 1);
        }
        const [tx, ty] = project(p.x, top, p.z);
        const reaches = p.heightM >= plane;
        ctx.fillStyle = picked ? burn : reaches ? fg : muted;
        ctx.globalAlpha = picked ? 1 : focusId ? (reaches ? 0.5 : 0.25) : reaches ? 0.95 : 0.45;
        const s = picked ? 3 : p.burned ? 2 : 1.6;
        ctx.fillRect(tx - s / 2, ty - s / 2, s, s);
        // Where a column crosses the plane, mark the intersection.
        if (!picked && reaches && p.heightM - plane < band * 6) {
          const [ix, iy] = project(p.x, py, p.z);
          ctx.fillStyle = select;
          ctx.globalAlpha = 0.9;
          ctx.fillRect(ix - 1, iy - 1, 2, 2);
        }
      };
      for (const p of cloud.pts) if (!focusId || p.groupId !== focusId) drawPoint(p, false);
      if (focusId) for (const p of cloud.pts) if (p.groupId === focusId) drawPoint(p, true);
      ctx.globalAlpha = 1;

      if (planeRef.current) {
        planeRef.current.textContent = `Plane ${plane.toFixed(1)} m · ${countAtOrAbove(cloud.pts, plane)}/${total} reach it`;
      }
    },
    { animate, deps: [cloud, focusId] },
  );

  return (
    <figure className="space-y-2">
      <div className={styles.instrument}>
        <span className={styles.corners} aria-hidden />
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`Point cloud of ${total} GEDI footprints at their true positions, each drawn up to its measured canopy height${focus ? `; the ${focus.count} footprints burned in ${focus.fireYear} are highlighted` : ''}. Rotation and the moving height plane are display only.`}
          className="h-52 w-full"
        />
      </div>
      <div className={cn(primitives.micro, 'flex items-center justify-between gap-3')}>
        <span ref={planeRef} aria-hidden className="text-(--select)" />
        <span className="type-coord">
          {cloud.lonSpan.toFixed(2)}° × {cloud.latSpan.toFixed(2)}°
        </span>
      </div>
      <figcaption className="text-[11px] leading-relaxed text-muted-foreground">
        {focus ? (
          <>
            <span className="text-(--burn-text)">Burgundy:</span> the {focus.count} footprints
            burned in {focus.fireYear}, median canopy {focus.medianHeightM.toFixed(1)} m.{' '}
          </>
        ) : (
          'Pick a fire year above to highlight its footprints. '
        )}
        The plane counts footprints whose canopy reaches it. Height is exaggerated; the motion is
        display only.
      </figcaption>
    </figure>
  );
}
