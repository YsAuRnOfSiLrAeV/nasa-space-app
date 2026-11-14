import { useMemo } from 'react';
import { Bar, BarChart, Cell, ReferenceLine, XAxis, YAxis } from 'recharts';
import { bin, max, range } from 'd3-array';
import { ChartContainer, ChartTooltip, type ChartConfig } from '@/components/ui/chart';
import { STAGE_BREAKS_M, type PointProperties } from '@/data/schema';
import { stageFromHeight } from '@/data/transform';

interface Bin {
  mid: number;
  x0: number;
  x1: number;
  count: number;
  stage: 0 | 1 | 2;
}

const DOMAIN: [number, number] = [0, 35];
const X_TICKS = [0, 5, 10, 15, 20, 25, 30, 35];
const AXIS_TICK = { fill: 'var(--muted-foreground)', fontSize: 9, fontFamily: 'var(--font-data)' };
const chartConfig = { count: { label: 'Points', color: 'var(--chart-1)' } } satisfies ChartConfig;

/**
 * Distribution of the observed GEDI canopy heights (1 m bins), coloured by the
 * stage each bin falls in, with the stage breaks marked: a measurement scale
 * built only from the loaded points.
 */
export function HeightDistribution({ points }: { points: PointProperties[] }) {
  const { bins, yMax } = useMemo(() => {
    const binner = bin<number, number>()
      .domain(DOMAIN)
      .thresholds(range(1, DOMAIN[1], 1));
    const bins: Bin[] = binner(points.map((p) => p.rh98_m)).map((b) => {
      const x0 = b.x0 ?? 0;
      const x1 = b.x1 ?? x0 + 1;
      return { mid: (x0 + x1) / 2, x0, x1, count: b.length, stage: stageFromHeight(x0) };
    });
    return { bins, yMax: max(bins, (b) => b.count) ?? 1 };
  }, [points]);

  return (
    <figure aria-label={`Distribution of GEDI canopy heights for ${points.length} points`}>
      <ChartContainer config={chartConfig} className="aspect-auto h-(--chart-height) w-full">
        <BarChart
          data={bins}
          margin={{ top: 4, right: 4, bottom: 0, left: -18 }}
          barCategoryGap={1}
        >
          <XAxis
            type="number"
            dataKey="mid"
            domain={DOMAIN}
            ticks={X_TICKS}
            tickLine={false}
            axisLine={{ stroke: 'var(--rule)' }}
            tick={AXIS_TICK}
            unit=" m"
          />
          <YAxis
            type="number"
            domain={[0, yMax]}
            ticks={[0, yMax]}
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            width={36}
            tick={AXIS_TICK}
          />
          {STAGE_BREAKS_M.map((m) => (
            <ReferenceLine key={m} x={m} stroke="var(--chart-reference)" strokeDasharray="3 3" />
          ))}
          <ChartTooltip
            cursor={{ fill: 'var(--accent)' }}
            content={({ active, payload }) => {
              const d = active ? (payload?.[0]?.payload as Bin | undefined) : undefined;
              if (!d) return null;
              return (
                <div className="rounded-md border bg-popover px-2.5 py-1.5 font-mono text-xs shadow-lg">
                  {d.x0}–{d.x1} m · {d.count} {d.count === 1 ? 'point' : 'points'}
                </div>
              );
            }}
          />
          <Bar dataKey="count" isAnimationActive={false}>
            {bins.map((b) => (
              <Cell key={b.x0} fill={`var(--stage-${b.stage})`} />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
    </figure>
  );
}
