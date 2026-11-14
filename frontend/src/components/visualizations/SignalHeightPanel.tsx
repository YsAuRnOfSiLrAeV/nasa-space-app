import { useMemo } from 'react';
import { CartesianGrid, ReferenceLine, Scatter, ScatterChart, XAxis, YAxis, ZAxis } from 'recharts';
import { extent } from 'd3-array';
import { format } from 'd3-format';
import { scaleLinear } from 'd3-scale';
import { ChartContainer, ChartTooltip, type ChartConfig } from '@/components/ui/chart';
import { STAGE_BREAKS_M, type PointProperties } from '@/data/schema';
import type { SignalSpec } from '@/components/study/signalEvidence';

interface Datum {
  id: string;
  height: number;
  value: number;
  status: PointProperties['status'];
}

const fmtRho = format('.2f');
const fmtHeight = format('.1f');
const X_DOMAIN: [number, number] = [0, 35];
const X_TICKS = [0, 5, 10, 20, 30];
/** Theme-relative: SVG presentation attributes resolve CSS variables. */
const AXIS_TICK = { fill: 'var(--muted-foreground)', fontSize: 10, fontFamily: 'var(--font-data)' };

const chartConfig = {
  value: { label: 'Signal', color: 'var(--chart-1)' },
} satisfies ChartConfig;

interface SignalHeightPanelProps {
  points: PointProperties[];
  signal: SignalSpec;
  /** Spearman ρ of this signal vs canopy height, from `rankSignals`. */
  rho: number;
  highlight?: boolean;
}

/**
 * One small multiple: GEDI canopy height (x) vs one satellite signal (y), with the
 * Spearman ρ as the headline. Each panel owns its y scale (different units), so we
 * never put two signals on one chart.
 */
export function SignalHeightPanel({
  points,
  signal,
  rho,
  highlight = false,
}: SignalHeightPanelProps) {
  const { data, yDomain, yTicks, fmtValue } = useMemo(() => {
    const data: Datum[] = points.map((p) => ({
      id: p.point_id,
      height: p.rh98_m,
      value: p[signal.key],
      status: p.status,
    }));
    const [lo = 0, hi = 1] = extent(data, (d) => d.value);
    const y = scaleLinear().domain([lo, hi]).nice(4);
    const yDomain = y.domain() as [number, number];
    const yTicks = y.ticks(4);
    const fmtValue = format(signal.unit === 'dB' ? '.1f' : '.2f');
    return { data, yDomain, yTicks, fmtValue };
  }, [points, signal]);

  const titleId = `signal-${signal.key}-title`;

  return (
    <figure aria-labelledby={titleId} className="space-y-1.5">
      <figcaption className="flex items-baseline justify-between gap-3">
        <span id={titleId} className="font-heading text-sm">
          {signal.label} <span className="text-muted-foreground">· {signal.detail}</span>
        </span>
        <span className="flex items-center gap-2">
          {highlight && (
            <span className="border border-signal/60 px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.14em] text-signal uppercase">
              strongest
            </span>
          )}
          <span
            className="font-mono text-sm tabular-nums"
            aria-label={`Spearman rho ${fmtRho(rho)}`}
          >
            ρ {fmtRho(rho)}
          </span>
        </span>
      </figcaption>

      <ChartContainer config={chartConfig} className="aspect-auto h-(--chart-height) w-full">
        <ScatterChart margin={{ top: 6, right: 6, bottom: 0, left: -12 }} accessibilityLayer>
          <CartesianGrid
            vertical={false}
            stroke="var(--border)"
            strokeDasharray="var(--chart-grid-dash)"
          />
          {STAGE_BREAKS_M.map((m) => (
            <ReferenceLine key={m} x={m} stroke="var(--faint)" strokeDasharray="3 3" />
          ))}
          <XAxis
            type="number"
            dataKey="height"
            domain={X_DOMAIN}
            ticks={X_TICKS}
            tickLine={false}
            axisLine={false}
            tick={AXIS_TICK}
            unit=" m"
          />
          <YAxis
            type="number"
            dataKey="value"
            domain={yDomain}
            ticks={yTicks}
            tickFormatter={(v: number) => fmtValue(v)}
            tickLine={false}
            axisLine={false}
            width={44}
            tick={AXIS_TICK}
          />
          <ZAxis range={[22, 22]} />
          <ChartTooltip
            cursor={false}
            content={({ active, payload }) => {
              const d = active ? (payload?.[0]?.payload as Datum | undefined) : undefined;
              if (!d) return null;
              return (
                <div className="rounded-lg border bg-popover px-2.5 py-1.5 text-xs shadow-lg">
                  <div className="font-mono tabular-nums">
                    {fmtHeight(d.height)} m · {fmtValue(d.value)} {signal.unit}
                  </div>
                  <div className="text-muted-foreground">
                    {d.status === 'burned' ? 'Burned 2001–2012' : 'Unburned reference'}
                  </div>
                </div>
              );
            }}
          />
          <Scatter
            data={data}
            fill="var(--color-value)"
            fillOpacity="var(--chart-point-opacity)"
            stroke="var(--card)"
            strokeWidth={0.75}
            isAnimationActive={false}
          />
        </ScatterChart>
      </ChartContainer>
    </figure>
  );
}
