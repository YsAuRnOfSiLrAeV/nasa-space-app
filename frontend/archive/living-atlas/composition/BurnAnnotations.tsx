import { useEffect, useRef, useState } from 'react';
import type { StudyMapController } from '@/components/map/StudyMapController';
import { formatLat, formatLon } from '@/components/map/graticule';
import { measureInsets } from '@/components/map/measureInsets';
import type { BurnGroup } from '@/components/study/burnGroups';
import styles from './LivingAtlas.module.css';

const CALLOUTS = 4;
const LABEL_W = 216;
const LABEL_H = 90;
const LEADER = 46;

interface Placed {
  g: BurnGroup;
  x: number;
  y: number;
  label?: { left: number; top: number; ax: number; ay: number };
}

interface Layout {
  w: number;
  h: number;
  placed: Placed[];
}

const overlaps = (a: DOMRectLike, b: DOMRectLike) =>
  a.left < b.left + b.width &&
  b.left < a.left + a.width &&
  a.top < b.top + b.height &&
  b.top < a.top + a.height;
interface DOMRectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

function layout(
  mapView: StudyMapController,
  el: HTMLElement,
  groups: BurnGroup[],
  withLabels: boolean,
): Layout {
  const w = el.clientWidth;
  const h = el.clientHeight;
  const ins = measureInsets(el);
  const vx0 = ins.left + 8;
  const vy0 = ins.top + 8;
  const vx1 = w - ins.right - 8;
  const vy1 = h - ins.bottom - 8;
  const cx = (vx0 + vx1) / 2;
  const cy = (vy0 + vy1) / 2;

  const taken: DOMRectLike[] = [];
  const placed: Placed[] = groups.map((g, i) => {
    const p = mapView.project(g.centroid);
    const out: Placed = { g, x: p.x, y: p.y };
    if (!withLabels || i >= CALLOUTS) return out;
    // Push the label away from the viewport centre so it never sits on the data cloud's core.
    const dx = p.x >= cx ? 1 : -1;
    const dy = p.y >= cy ? 1 : -1;
    const ax = p.x + dx * LEADER;
    const ay = p.y + dy * LEADER * 0.6;
    const left = dx > 0 ? ax : ax - LABEL_W;
    const top = dy > 0 ? ay : ay - LABEL_H;
    const rect = { left, top, width: LABEL_W, height: LABEL_H };
    const inside = left >= vx0 && top >= vy0 && left + LABEL_W <= vx1 && top + LABEL_H <= vy1;
    if (inside && !taken.some((t) => overlaps(t, rect))) {
      taken.push(rect);
      out.label = { left, top, ax, ay };
    }
    return out;
  });
  return { w, h, placed };
}

/**
 * Cartographic annotation of the real burn-scar groups: contour-style rings at
 * each group's centroid (p09) and leader-line call-outs for the largest (p10).
 */
export function BurnAnnotations({
  mapView,
  groups,
  visible,
  focusId = null,
}: {
  mapView: StudyMapController | null;
  groups: BurnGroup[];
  visible: boolean;
  /** Group located from the register: drawn with a solid ring and a pulse. */
  focusId?: string | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<Layout | null>(null);
  const ringScale = state ? Math.min(1, Math.max(0.5, state.w / 1200)) : 1;

  useEffect(() => {
    const el = ref.current;
    if (!mapView || !el || !visible) return;
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() =>
        setState(layout(mapView, el, groups, el.clientWidth >= 640)),
      );
    };
    update();
    const unsubscribe = mapView.onViewChange(update);
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      unsubscribe();
      ro.disconnect();
    };
  }, [mapView, groups, visible]);

  return (
    <div ref={ref} className="pointer-events-none absolute inset-0" aria-hidden={!visible}>
      {visible && state && (
        <>
          {/* Rings and leaders are drawing only; the call-out text and the register carry the data. */}
          <svg aria-hidden width={state.w} height={state.h} className="absolute inset-0">
            {/* Rings shrink on small viewports so neighbouring groups stay legible. */}
            {state.placed.map(({ g, x, y, label }) => (
              <g key={g.id}>
                {[22, 15, 9].map((r, k) => (
                  <circle
                    key={r}
                    cx={x}
                    cy={y}
                    r={r * ringScale * (0.75 + Math.min(g.count, 34) / 68)}
                    fill="none"
                    stroke="var(--amber)"
                    strokeOpacity={0.35 + k * 0.25}
                    strokeWidth={k === 2 ? 1.5 : 1}
                  />
                ))}
                {g.id === focusId && (
                  <>
                    <circle cx={x} cy={y} r={5} fill="var(--amber)" />
                    <circle
                      className={styles.pulse}
                      cx={x}
                      cy={y}
                      r={22 * ringScale}
                      fill="none"
                      stroke="var(--amber)"
                      strokeWidth="1.5"
                    />
                  </>
                )}
                {label && (
                  <path
                    d={`M${x} ${y}L${label.ax} ${label.ay}`}
                    stroke="#1f3a2b"
                    strokeWidth="1"
                    fill="none"
                  />
                )}
                {label && <circle cx={label.ax} cy={label.ay} r="2" fill="#1f3a2b" />}
              </g>
            ))}
          </svg>
          {state.placed.map(({ g, label }) =>
            label ? (
              <div
                key={g.id}
                className={styles.callout}
                style={{ left: label.left, top: label.top, width: LABEL_W }}
              >
                <div className={styles.calloutTag}>Burned {g.fireYear}</div>
                <div className={styles.calloutBody}>
                  {g.ageYears} years since fire · {g.count} sample points
                  <br />
                  Median canopy {g.medianHeightM.toFixed(1)} m · {Math.round(g.shareTall * 100)}% ≥
                  10 m
                </div>
                <div className={styles.calloutCoord}>
                  {formatLat(g.centroid[1], 0.01)} {formatLon(g.centroid[0], 0.01)}
                </div>
              </div>
            ) : null,
          )}
        </>
      )}
    </div>
  );
}
