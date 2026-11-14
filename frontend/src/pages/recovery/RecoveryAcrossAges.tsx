import { useMemo, useRef } from 'react';
import { extent } from 'd3-array';
import { scaleLinear, type ScaleLinear } from 'd3-scale';
import { cn } from '@/lib/utils';
import { recoveryHref } from '@/app/route';
import {
  RECOVERY_METRICS,
  chronosequence,
  type ChronoColumn,
  type MetricInfo,
} from '@/components/study/recovery';
import ui from '@/components/shell/primitives.module.css';
import type { StudyView } from '@/components/study/studyView';
import { AxisText, YGrid } from '@/components/visualizations/svgAxes';
import { ChartLegend } from '@/components/visualizations/ChartLegend';
import { useElementWidth } from '@/hooks/useElementWidth';

const H = 210;
const M = { top: 10, right: 6, bottom: 36, left: 38 };
/** Stage breaks drawn on the canopy-height chart, as elsewhere in the app. */
const HEIGHT_BREAKS_M = [5, 10];

/** Deterministic horizontal spread for the dots in a column (same layout every render). */
const jitter = (i: number) => ((i * 0.618034) % 1) - 0.5;

const fmt = (v: number, digits: number) => v.toFixed(digits);

/** Hover text for one column. */
function columnTitle(c: ChronoColumn, metric: MetricInfo) {
  const unit = metric.unit ? ` ${metric.unit}` : '';
  const stats = `${c.values.length} points, median ${fmt(c.median, metric.digits)}${unit}`;
  return c.id === 'reference'
    ? `Unburned reference forest: ${stats}`
    : `Burn group ${c.label} (${c.ageYears} years before 2026): ${stats}`;
}

/**
 * Small multiples, one per measurement: every burn group as a column, youngest
 * fire on the left, unburned reference forest on the right. Dots are sample
 * points, the bar is the group median, the selected group is burgundy.
 */
export function RecoveryAcrossAges({ study, groupId }: { study: StudyView; groupId: string }) {
  const charts = useMemo(
    () =>
      RECOVERY_METRICS.map((m) => ({
        metric: m,
        cols: chronosequence(study.located, study.burnGroups, m.key),
      })),
    [study],
  );
  return (
    <div className="space-y-4">
      <Legend />
      <div className="grid gap-x-8 gap-y-6 lg:grid-cols-2">
        {charts.map(({ metric, cols }) => (
          <MetricChart key={metric.key} metric={metric} cols={cols} groupId={groupId} />
        ))}
      </div>
      <MedianTable charts={charts} groupId={groupId} />
    </div>
  );
}

function Legend() {
  return (
    <ChartLegend
      items={[
        { swatch: 'dot', color: 'var(--burn)', label: 'Selected group' },
        {
          swatch: 'dot',
          color: 'color-mix(in srgb, var(--foreground) 50%, transparent)',
          label: 'Other burn groups',
        },
        { swatch: 'ring', color: 'var(--forest)', label: 'Unburned reference forest' },
        { swatch: 'line', color: 'var(--foreground)', label: 'Median' },
      ]}
    />
  );
}

function MetricChart({
  metric,
  cols,
  groupId,
}: {
  metric: MetricInfo;
  cols: ChronoColumn[];
  groupId: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const width = useElementWidth(ref);
  const all = cols.flatMap((c) => c.values);
  const [lo = 0, hi = 1] = extent(all);
  const y = scaleLinear()
    .domain(metric.key === 'rh98_m' ? [0, hi] : [lo, hi])
    .range([H - M.bottom, M.top])
    .nice(4);
  const innerW = Math.max(0, width - M.left - M.right);
  const band = innerW / cols.length;
  const selected = cols.find((c) => c.id === groupId);
  const unit = metric.unit ? ` ${metric.unit}` : '';

  return (
    <figure className="min-w-0">
      <figcaption className="mb-2 flex items-baseline justify-between gap-3">
        <span className="text-sm text-foreground">
          {metric.title}
          {metric.unit && <span className="text-muted-foreground"> · {metric.unit}</span>}
        </span>
        <span className={cn(ui.micro, 'text-right text-[9px]')}>
          {metric.source} · {metric.when}
        </span>
      </figcaption>
      <div ref={ref}>
        {width > 0 && (
          <svg
            width={width}
            height={H}
            role="img"
            aria-label={`${metric.title} by fire age.${selected ? ` Selected group median ${fmt(selected.median, metric.digits)}${unit} from ${selected.values.length} points.` : ''} Unburned reference median ${fmt(cols.at(-1)!.median, metric.digits)}${unit}. The table below lists every group.`}
            className="overflow-visible"
          >
            <YGrid
              scale={y}
              ticks={4}
              left={M.left}
              right={width - M.right}
              format={(t) => (metric.digits > 1 ? t.toFixed(1) : String(t))}
            />
            {metric.key === 'rh98_m' &&
              HEIGHT_BREAKS_M.map((b) => (
                <line
                  key={b}
                  x1={M.left}
                  x2={width - M.right}
                  y1={y(b)}
                  y2={y(b)}
                  stroke="var(--chart-reference)"
                  strokeDasharray="3 3"
                  strokeOpacity="0.7"
                />
              ))}

            {/* Reference separator */}
            <line
              x1={M.left + band * (cols.length - 1)}
              x2={M.left + band * (cols.length - 1)}
              y1={M.top}
              y2={H - M.bottom}
              stroke="var(--rule)"
            />

            {cols.map((c, i) => {
              const column = (
                <ChronoColumnMarks
                  col={c}
                  selected={c.id === groupId}
                  x0={M.left + band * i}
                  band={band}
                  y={y}
                  label={columnTitle(c, metric)}
                />
              );
              // Groups link to their own recovery page (mouse shortcut; the picker is the keyboard path).
              return c.id === 'reference' ? (
                <g key={c.id}>{column}</g>
              ) : (
                <a key={c.id} href={recoveryHref(c.id)} tabIndex={-1} className="cursor-pointer">
                  {column}
                </a>
              );
            })}
          </svg>
        )}
      </div>
    </figure>
  );
}

/** One column: the group's points (jittered), its median bar, and age / count labels. */
function ChronoColumnMarks({
  col,
  selected,
  x0,
  band,
  y,
  label,
}: {
  col: ChronoColumn;
  selected: boolean;
  /** Left edge and width of the column's band. */
  x0: number;
  band: number;
  y: ScaleLinear<number, number>;
  label: string;
}) {
  const isRef = col.id === 'reference';
  const cx = x0 + band / 2;
  const fill = selected ? 'var(--burn)' : isRef ? 'none' : 'var(--foreground)';
  return (
    <g>
      <title>{label}</title>
      {/* Hit area wider than the marks. */}
      <rect
        x={x0}
        y={M.top}
        width={band}
        height={H - M.top - M.bottom}
        fill={selected ? 'var(--burn)' : 'transparent'}
        fillOpacity={selected ? 0.06 : 0}
      />
      {col.values.map((v, k) => (
        <circle
          key={k}
          cx={cx + jitter(k) * band * 0.55}
          cy={y(v)}
          r={selected ? 2.6 : 2.1}
          fill={fill}
          fillOpacity={selected ? 0.9 : 0.32}
          stroke={isRef ? 'var(--forest)' : 'none'}
          strokeOpacity={0.55}
        />
      ))}
      <line
        x1={cx - band * 0.32}
        x2={cx + band * 0.32}
        y1={y(col.median)}
        y2={y(col.median)}
        stroke={selected ? 'var(--burn)' : 'var(--foreground)'}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <AxisText x={cx} y={H - M.bottom + 14} emphasis={selected}>
        {isRef ? 'Ref' : `${col.ageYears}y`}
      </AxisText>
      <AxisText x={cx} y={H - M.bottom + 26} size={8}>
        {isRef ? 'unburned' : `n${col.values.length}`}
      </AxisText>
    </g>
  );
}

function MedianTable({
  charts,
  groupId,
}: {
  charts: { metric: MetricInfo; cols: ChronoColumn[] }[];
  groupId: string;
}) {
  const rows = charts[0]!.cols;
  return (
    <details>
      <summary className={cn(ui.micro, 'cursor-pointer')}>Show the medians as a table</summary>
      <div className="mt-3 overflow-x-auto">
        <table className={cn(ui.register, 'min-w-[34rem]')}>
          <caption className="sr-only">
            Median of each measurement per burn group, youngest fire first, and for unburned
            reference forest.
          </caption>
          <thead>
            <tr>
              <th scope="col">Group</th>
              <th scope="col">Age</th>
              <th scope="col">n</th>
              {charts.map(({ metric }) => (
                <th key={metric.key} scope="col">
                  {metric.title.split(' (')[0]}
                  {metric.unit && ` (${metric.unit})`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} className={cn(r.id === groupId && ui.registerActive)}>
                <th scope="row" className="py-2">
                  {r.id === 'reference' ? 'Unburned reference' : `Burned ${r.label}`}
                </th>
                <td>{r.ageYears === null ? '·' : `${r.ageYears} y`}</td>
                <td>{r.values.length}</td>
                {charts.map(({ metric, cols }) => (
                  <td key={metric.key}>{fmt(cols[i]!.median, metric.digits)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
