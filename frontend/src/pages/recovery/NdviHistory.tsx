import { useRef, useState } from 'react';
import { scaleLinear } from 'd3-scale';
import { cn } from '@/lib/utils';
import type { NdviYear, RecoveryFile } from '@/data/recoverySchema';
import { ndviDomain } from '@/data/landsat';
import { platformLabel } from '@/domain/study/recovery';
import ui from '@/components/shell/primitives.module.css';
import { AxisText, YGrid } from '@/components/visualizations/svgAxes';
import { ChartLegend } from '@/components/visualizations/ChartLegend';
import { NdviLines } from './NdviLines';
import { useElementWidth } from '@/hooks/useElementWidth';
import { GreennessTrend } from './GreennessTrend';

const H = 260;
const M = { top: 14, right: 12, bottom: 30, left: 40 };

/**
 * Summer NDVI per year for the burned group (burgundy, solid) and nearby unburned
 * forest (dashed, hollow). Points are medians; gaps are years without a clear
 * observation and are left empty.
 */
export function NdviHistory({
  landsat,
  highlightYear,
}: {
  landsat: RecoveryFile;
  highlightYear?: number | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const width = useElementWidth(ref);
  const [hover, setHover] = useState<number | null>(null);
  const rows = landsat.ndvi;
  const [y0, y1] = landsat.years;
  const x = scaleLinear()
    .domain([y0 - 0.5, y1 + 0.5])
    .range([M.left, Math.max(M.left + 1, width - M.right)]);
  const y = scaleLinear()
    .domain(ndviDomain(rows))
    .range([H - M.bottom, M.top])
    .nice(5);
  const fire = landsat.fire_year;
  const hovered = rows.find((r) => r.year === hover) ?? null;
  const missing = rows.filter((r) => !r.burned).length;

  return (
    <figure className="min-w-0 space-y-3">
      <ChartLegend
        items={[
          { swatch: 'line', color: 'var(--burn)', label: 'This burn group' },
          {
            swatch: 'dashed',
            color: 'var(--forest)',
            label: `Unburned forest within ${landsat.reference.max_distance_km} km (${landsat.reference.point_ids.length} points)`,
          },
          { swatch: 'tick', color: 'var(--burn)', label: `Fire ${fire}` },
        ]}
      />
      <div ref={ref} className="relative" onMouseLeave={() => setHover(null)}>
        {width > 0 && (
          <svg
            width={width}
            height={H}
            role="img"
            aria-label={`Summer NDVI from ${y0} to ${y1} for the burn group and for unburned forest nearby. ${missing} of ${rows.length} years have no clear observation and are left empty. The table below lists every year.`}
          >
            <YGrid
              scale={y}
              ticks={5}
              left={M.left}
              right={width - M.right}
              format={(t) => t.toFixed(1)}
            />
            {x
              .ticks(Math.min(8, Math.floor(width / 70)))
              .filter(Number.isInteger)
              .map((t) => (
                <AxisText key={t} x={x(t)} y={H - M.bottom + 16}>
                  {t}
                </AxisText>
              ))}
            {/* Missing years: a faint hatch so the gap reads as "no data", not as a drop. */}
            {rows
              .filter((r) => !r.burned)
              .map((r) => (
                <rect
                  key={r.year}
                  x={x(r.year - 0.5)}
                  width={x(1) - x(0)}
                  y={M.top}
                  height={H - M.top - M.bottom}
                  fill="var(--foreground)"
                  fillOpacity="0.035"
                />
              ))}
            {highlightYear != null && highlightYear >= y0 && highlightYear <= y1 && (
              <rect
                x={x(highlightYear - 0.5)}
                width={x(1) - x(0)}
                y={M.top}
                height={H - M.top - M.bottom}
                fill="var(--select)"
                fillOpacity="0.12"
              />
            )}
            <line
              x1={x(fire)}
              x2={x(fire)}
              y1={M.top}
              y2={H - M.bottom}
              stroke="var(--burn)"
              strokeOpacity="0.7"
            />
            <NdviLines rows={rows} x={x} y={y} />
            {rows.map((r) => (
              <g key={r.year}>
                {r.reference && (
                  <circle
                    cx={x(r.year)}
                    cy={y(r.reference.median)}
                    r="3"
                    fill="var(--background)"
                    stroke="var(--forest)"
                    strokeWidth="1.5"
                  />
                )}
                {r.burned && (
                  <circle
                    cx={x(r.year)}
                    cy={y(r.burned.median)}
                    r="3.5"
                    fill="var(--burn)"
                    stroke="var(--background)"
                    strokeWidth="1.5"
                  />
                )}
              </g>
            ))}
            {hover !== null && (
              <line
                x1={x(hover)}
                x2={x(hover)}
                y1={M.top}
                y2={H - M.bottom}
                stroke="var(--foreground)"
                strokeOpacity="0.35"
              />
            )}
            {/* Hit areas: one per year, wider than the marks. */}
            {rows.map((r) => (
              <rect
                key={r.year}
                x={x(r.year - 0.5)}
                width={x(1) - x(0)}
                y={M.top}
                height={H - M.top - M.bottom}
                fill="transparent"
                onMouseEnter={() => setHover(r.year)}
              />
            ))}
          </svg>
        )}
        {hovered && (
          <div
            className="pointer-events-none absolute top-2 z-10 w-56 rounded-(--radius) border border-rule bg-(--popover) p-3 text-xs shadow-lg"
            style={
              x(hovered.year) > width / 2
                ? { left: Math.max(0, x(hovered.year) - 236) }
                : { left: x(hovered.year) + 12 }
            }
          >
            <p className="mb-1.5 font-mono text-foreground">
              {hovered.year}
              {hovered.year === fire && <span className="text-(--burn-text)"> · fire year</span>}
            </p>
            <Readout label="Burn group" s={hovered.burned} />
            <Readout label="Unburned" s={hovered.reference} />
            <p className="mt-1.5 text-[10px] text-muted-foreground">
              {hovered.platforms.length
                ? hovered.platforms.map(platformLabel).join(', ')
                : 'No clear scene'}
            </p>
          </div>
        )}
      </div>
      <figcaption className="text-[11px] leading-relaxed text-muted-foreground">
        {landsat.source.method ?? (
          <>
            NDVI from Landsat surface reflectance, 15 June to 15 September. Clouds, shadow, cirrus
            and snow are masked per pixel; each point&apos;s summer median, then the median across
            points. Landsat 5, 7 and 8–9 sensors differ slightly and are not cross-calibrated here.
            NDVI measures greenness: grasses and shrubs raise it long before trees return, so
            compare it with the canopy height and L-band radar below.
          </>
        )}
        {landsat.source.quality_policy && <> {landsat.source.quality_policy}</>}{' '}
        {landsat.source.citation}.
      </figcaption>
      <details>
        <summary className={cn(ui.micro, 'cursor-pointer')}>Show every year as a table</summary>
        <div className="mt-3 max-h-80 overflow-auto">
          <table className={cn(ui.register, 'min-w-[30rem]')}>
            <caption className="sr-only">
              Summer NDVI by year: median, points and observations, and sensors
            </caption>
            <thead>
              <tr>
                <th scope="col">Year</th>
                <th scope="col">Burn group</th>
                <th scope="col">Points</th>
                <th scope="col">Unburned</th>
                <th scope="col">Sensors</th>
                {landsat.source.quality_policy && <th scope="col">QA counts</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.year} className={cn(r.year === fire && ui.registerActive)}>
                  <th scope="row" className="py-1.5">
                    {r.year}
                  </th>
                  <td>{r.burned ? r.burned.median.toFixed(2) : 'no data'}</td>
                  <td>{r.burned ? `${r.burned.n_points} (${r.burned.n_obs} obs)` : '·'}</td>
                  <td>{r.reference ? r.reference.median.toFixed(2) : 'no data'}</td>
                  <td>
                    {r.platforms.map((p) => platformLabel(p).replace('Landsat ', 'L')).join(' ') ||
                      '·'}
                  </td>
                  {landsat.source.quality_policy && (
                    <td>
                      {r.quality
                        ? `${r.quality.accepted} accepted · ${r.quality.rejected} rejected · ${r.quality.missing} fill/missing`
                        : 'not supplied'}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <GreennessTrend record={landsat} />
    </figure>
  );
}

function Readout({ label, s }: { label: string; s: NdviYear['burned'] }) {
  return (
    <p className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-foreground">
        {s ? `${s.median.toFixed(2)} · ${s.n_points} pts` : 'no data'}
      </span>
    </p>
  );
}
