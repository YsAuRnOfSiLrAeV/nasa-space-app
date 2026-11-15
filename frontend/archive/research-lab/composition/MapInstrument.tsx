import { useEffect, useRef, useState } from 'react';
import type { StudyMapController } from '@/components/map/StudyMapController';
import { formatLat, formatLon, graticuleStep, graticuleTicks } from '@/components/map/graticule';
import { measureInsets } from '@/components/map/measureInsets';
import type { Insets } from '@/components/map/occluders';

interface Frame {
  w: number;
  h: number;
  /** Visible viewport (map area not covered by the composition), inset by MARGIN. */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  lons: { v: number; x: number }[];
  lats: { v: number; y: number }[];
  lonStep: number;
  latStep: number;
  centre: { lng: number; lat: number };
  zoom: number;
}

const MARGIN = 14;
/** Keep lat labels clear of the navigation control in the top-right corner. */
const CONTROL_CLEARANCE = 96;

function computeFrame(mapView: StudyMapController, el: HTMLElement): Frame {
  const w = el.clientWidth;
  const h = el.clientHeight;
  const ins: Insets = measureInsets(el);
  const x0 = ins.left + MARGIN;
  const y0 = ins.top + MARGIN;
  const x1 = w - ins.right - MARGIN;
  const y1 = h - ins.bottom - MARGIN;

  const b = mapView.bounds();
  const [cLng, cLat] = mapView.centre();
  const lonStep = graticuleStep(b.east - b.west);
  const latStep = graticuleStep(b.north - b.south);
  const lons = graticuleTicks(b.west, b.east, lonStep)
    .map((v) => ({ v, x: mapView.project([v, cLat]).x }))
    .filter((t) => t.x > x0 && t.x < x1);
  const lats = graticuleTicks(b.south, b.north, latStep)
    .map((v) => ({ v, y: mapView.project([cLng, v]).y }))
    .filter((t) => t.y > y0 && t.y < y1);
  const [lng, lat] = mapView.unproject({ x: (x0 + x1) / 2, y: (y0 + y1) / 2 });

  return {
    w,
    h,
    x0,
    y0,
    x1,
    y1,
    lons,
    lats,
    lonStep,
    latStep,
    centre: { lng, lat },
    zoom: mapView.zoom(),
  };
}

/**
 * Instrument overlay for the map (moodboard p05/p16): a real lat/lon graticule
 * from the live bounds, a viewport frame with corner ticks, a crosshair at the
 * visible centre and a live coordinate/zoom readout. Purely presentational.
 */
export function MapInstrument({ mapView }: { mapView: StudyMapController | null }) {
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

  const valid = f && f.x1 - f.x0 > 80 && f.y1 - f.y0 > 80;
  const cx = valid ? (f.x0 + f.x1) / 2 : 0;
  const cy = valid ? (f.y0 + f.y1) / 2 : 0;
  const T = 10; // corner tick length

  return (
    <div ref={ref} className="pointer-events-none absolute inset-0" aria-hidden>
      {valid && (
        <svg width={f.w} height={f.h} className="absolute inset-0 font-mono">
          <defs>
            <clipPath id="rl-viewport">
              <rect x={f.x0} y={f.y0} width={f.x1 - f.x0} height={f.y1 - f.y0} />
            </clipPath>
          </defs>

          {/* Graticule */}
          <g clipPath="url(#rl-viewport)" stroke="var(--foreground)" strokeOpacity="0.09">
            {f.lons.map((t) => (
              <line key={`x${t.v}`} x1={t.x} x2={t.x} y1={f.y0} y2={f.y1} />
            ))}
            {f.lats.map((t) => (
              <line key={`y${t.v}`} x1={f.x0} x2={f.x1} y1={t.y} y2={t.y} />
            ))}
          </g>

          {/* Viewport frame + corner ticks */}
          <rect
            x={f.x0}
            y={f.y0}
            width={f.x1 - f.x0}
            height={f.y1 - f.y0}
            fill="none"
            stroke="var(--rule)"
          />
          <g stroke="var(--foreground)" strokeOpacity="0.6">
            <path
              d={`M${f.x0} ${f.y0 + T}V${f.y0}H${f.x0 + T} M${f.x1 - T} ${f.y0}H${f.x1}V${f.y0 + T} M${f.x1} ${f.y1 - T}V${f.y1}H${f.x1 - T} M${f.x0 + T} ${f.y1}H${f.x0}V${f.y1 - T}`}
              fill="none"
            />
          </g>

          {/* Edge ticks + degree labels */}
          <g fontSize="9" fill="var(--muted-foreground)" letterSpacing="0.06em">
            {f.lons.map((t) => (
              <g key={`lx${t.v}`}>
                <line
                  x1={t.x}
                  x2={t.x}
                  y1={f.y1}
                  y2={f.y1 - 5}
                  stroke="var(--foreground)"
                  strokeOpacity="0.5"
                />
                <text x={t.x + 4} y={f.y1 - 6}>
                  {formatLon(t.v, f.lonStep)}
                </text>
              </g>
            ))}
            {f.lats
              .filter((t) => t.y > f.y0 + CONTROL_CLEARANCE)
              .map((t) => (
                <g key={`ly${t.v}`}>
                  <line
                    x1={f.x1}
                    x2={f.x1 - 5}
                    y1={t.y}
                    y2={t.y}
                    stroke="var(--foreground)"
                    strokeOpacity="0.5"
                  />
                  <text x={f.x1 - 8} y={t.y - 4} textAnchor="end">
                    {formatLat(t.v, f.latStep)}
                  </text>
                </g>
              ))}
          </g>

          {/* Crosshair at the visible centre */}
          <g stroke="var(--foreground)" strokeOpacity="0.55">
            <path
              d={`M${cx - 14} ${cy}h9 M${cx + 5} ${cy}h9 M${cx} ${cy - 14}v9 M${cx} ${cy + 5}v9`}
            />
          </g>
          <circle cx={cx} cy={cy} r="1.6" fill="var(--amber)" />

          {/* Live readout */}
          <g fontSize="9" letterSpacing="0.12em" fill="var(--muted-foreground)">
            <text x={f.x0 + 10} y={f.y0 + 18}>
              <tspan fill="var(--amber)">● </tspan>
              VIEWPORT CTR {formatLat(f.centre.lat)} {formatLon(f.centre.lng)}
            </text>
            <text x={f.x0 + 10} y={f.y0 + 32}>
              ZOOM {f.zoom.toFixed(2)} · GRID {f.lonStep}° × {f.latStep}°
            </text>
          </g>
        </svg>
      )}
    </div>
  );
}
