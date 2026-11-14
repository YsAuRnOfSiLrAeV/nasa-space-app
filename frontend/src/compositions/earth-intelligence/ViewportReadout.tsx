import { useEffect, useRef, useState } from 'react';
import type { StudyMapController } from '@/components/map/StudyMapController';
import { formatLonLat } from '@/components/map/graticule';
import { measureInsets } from '@/components/map/measureInsets';

interface Frame {
  w: number;
  h: number;
  /** Visible map area (not covered by header, panel or footer), inset by MARGIN. */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  centre: [number, number];
  zoom: number;
}

const MARGIN = 14;
/** Corner tick length. */
const T = 10;

function computeFrame(mapView: StudyMapController, el: HTMLElement): Frame {
  const ins = measureInsets(el);
  const w = el.clientWidth;
  const h = el.clientHeight;
  const x0 = ins.left + MARGIN;
  const y0 = ins.top + MARGIN;
  const x1 = w - ins.right - MARGIN;
  const y1 = h - ins.bottom - MARGIN;
  return {
    w,
    h,
    x0,
    y0,
    x1,
    y1,
    centre: mapView.unproject({ x: (x0 + x1) / 2, y: (y0 + y1) / 2 }),
    zoom: mapView.zoom(),
  };
}

/**
 * A light instrument frame over the visible map (from the archived Research
 * Lab theme): corner ticks, a crosshair at the visible centre and its
 * coordinates and zoom, read from the camera on every move. Decorative: the
 * map itself carries the data.
 */
export function ViewportReadout({ mapView }: { mapView: StudyMapController | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const [f, setFrame] = useState<Frame | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!mapView || !el) return;
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setFrame(computeFrame(mapView, el)));
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
  }, [mapView]);

  // Too small to frame (e.g. phones, where the sheet covers half the map): draw nothing.
  const valid = f && f.x1 - f.x0 > 240 && f.y1 - f.y0 > 200;
  const cx = valid ? (f.x0 + f.x1) / 2 : 0;
  const cy = valid ? (f.y0 + f.y1) / 2 : 0;

  return (
    <div ref={ref} aria-hidden className="pointer-events-none absolute inset-0">
      {valid && (
        <svg width={f.w} height={f.h} className="absolute inset-0">
          <path
            d={`M${f.x0} ${f.y0 + T}V${f.y0}H${f.x0 + T} M${f.x1 - T} ${f.y0}H${f.x1}V${f.y0 + T} M${f.x1} ${f.y1 - T}V${f.y1}H${f.x1 - T} M${f.x0 + T} ${f.y1}H${f.x0}V${f.y1 - T}`}
            fill="none"
            stroke="var(--foreground)"
            strokeOpacity="0.45"
          />
          <path
            d={`M${cx - 14} ${cy}h9 M${cx + 5} ${cy}h9 M${cx} ${cy - 14}v9 M${cx} ${cy + 5}v9`}
            stroke="var(--foreground)"
            strokeOpacity="0.4"
          />
          <circle cx={cx} cy={cy} r="1.6" fill="var(--select)" />
          <g
            fontSize="9"
            letterSpacing="0.14em"
            fill="var(--muted-foreground)"
            style={{ fontFamily: 'var(--font-coord)' }}
          >
            <text x={f.x0 + 12} y={f.y0 + 18}>
              <tspan fill="var(--select)">● </tspan>
              VIEWPORT CTR {formatLonLat(f.centre, 0.001)}
            </text>
            <text x={f.x0 + 12} y={f.y0 + 32}>
              ZOOM {f.zoom.toFixed(2)}
            </text>
          </g>
        </svg>
      )}
    </div>
  );
}
