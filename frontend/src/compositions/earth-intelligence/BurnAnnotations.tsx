import { useEffect, useRef, useState } from 'react';
import type { StudyMapController } from '@/components/map/StudyMapController';
import { formatLonLat } from '@/domain/globe/graticule';
import { recoveryHref } from '@/app/route';
import { measureInsets } from '@/components/map/measureInsets';
import type { BurnGroup } from '@/domain/study/burnGroups';
import styles from './EarthIntelligence.module.css';

/** Call-outs drawn at once; the picked group always gets the first one. */
const CALLOUTS = 4;
const LABEL_W = 232;
const LABEL_H = 104;
const LEADER = 46;

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

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

const overlaps = (a: Rect, b: Rect) =>
  a.left < b.left + b.width &&
  b.left < a.left + a.width &&
  a.top < b.top + b.height &&
  b.top < a.top + a.height;

function layout(
  mapView: StudyMapController,
  el: HTMLElement,
  groups: BurnGroup[],
  focusId: string | null,
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

  // Label priority: the picked group, then the largest groups.
  const ordered = [...groups].sort((a, b) => Number(b.id === focusId) - Number(a.id === focusId));
  const taken: Rect[] = [];
  const placed = ordered.map((g, i): Placed => {
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
 * Burn-scar groups drawn on the map: contour-style rings at each group's
 * centroid, leader-line call-outs, and a pulse on the fire year picked in the
 * register. Positions follow the camera through the map controller.
 */
export function BurnAnnotations({
  mapView,
  groups,
  focusId,
}: {
  mapView: StudyMapController | null;
  groups: BurnGroup[];
  focusId: string | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<Layout | null>(null);
  const ringScale = state ? Math.min(1, Math.max(0.5, state.w / 1200)) : 1;

  useEffect(() => {
    const el = ref.current;
    if (!mapView || !el) return;
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() =>
        setState(layout(mapView, el, groups, focusId, el.clientWidth >= 640)),
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
  }, [mapView, groups, focusId]);

  return (
    // Drawing only: the register carries the same values for assistive technology.
    <div ref={ref} aria-hidden className="pointer-events-none absolute inset-0">
      {state && (
        <>
          <svg width={state.w} height={state.h} className="absolute inset-0">
            {state.placed.map(({ g, x, y, label }) => {
              const focused = g.id === focusId;
              return (
                <g key={g.id} opacity={focusId && !focused ? 0.45 : 1}>
                  {[22, 15, 9].map((r, k) => (
                    <circle
                      key={r}
                      cx={x}
                      cy={y}
                      r={r * ringScale * (0.75 + Math.min(g.count, 34) / 68)}
                      fill="none"
                      stroke="var(--burn-text)"
                      strokeOpacity={0.3 + k * 0.25}
                      strokeWidth={k === 2 ? 1.5 : 1}
                    />
                  ))}
                  {focused && (
                    <>
                      <circle cx={x} cy={y} r={4} fill="var(--burn-text)" />
                      <circle
                        className={styles.pulse}
                        cx={x}
                        cy={y}
                        r={22 * ringScale}
                        fill="none"
                        stroke="var(--burn-text)"
                        strokeWidth="1.5"
                      />
                    </>
                  )}
                  {label && (
                    <>
                      <path
                        d={`M${x} ${y}L${label.ax} ${label.ay}`}
                        stroke="var(--foreground)"
                        strokeOpacity={0.55}
                        strokeWidth="1"
                        fill="none"
                      />
                      <circle cx={label.ax} cy={label.ay} r="2" fill="var(--foreground)" />
                    </>
                  )}
                </g>
              );
            })}
          </svg>
          {state.placed.map(({ g, label }) =>
            label ? (
              <div
                key={g.id}
                className={styles.callout}
                data-focused={g.id === focusId || undefined}
                style={{ left: label.left, top: label.top, width: LABEL_W }}
              >
                <div className={styles.calloutTag}>Burned {g.label}</div>
                <div className={styles.calloutBody}>
                  {g.ageYears} years since fire · {g.count} sample points
                  <br />
                  Median canopy {g.medianHeightM.toFixed(1)} m · {Math.round(g.shareTall * 100)}% ≥
                  10 m
                </div>
                <div className={styles.calloutCoord}>{formatLonLat(g.centroid)}</div>
                {/* Mouse shortcut on the picked group; keyboard users have the same link under the register. */}
                {g.id === focusId && (
                  <a href={recoveryHref(g.id)} tabIndex={-1} className={styles.calloutLink}>
                    Recovery evidence ↗
                  </a>
                )}
              </div>
            ) : null,
          )}
        </>
      )}
    </div>
  );
}
