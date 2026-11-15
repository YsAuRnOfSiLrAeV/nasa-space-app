import type { ComponentProps } from 'react';
import { cn } from 'cn';
import { ResponsiveContainer, Tooltip } from 'recharts';

const INITIAL_DIMENSION = { width: 320, height: 200 } as const;

/** A Recharts chart in a sized box, with Recharts' default greys mapped to the theme. */
function ChartContainer({
  className,
  children,
}: {
  className?: string;
  children: ComponentProps<typeof ResponsiveContainer>['children'];
}) {
  return (
    <div
      data-slot="chart"
      className={cn(
        "flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-layer]:outline-hidden [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border [&_.recharts-surface]:outline-hidden",
        className,
      )}
    >
      <ResponsiveContainer initialDimension={INITIAL_DIMENSION}>{children}</ResponsiveContainer>
    </div>
  );
}

const ChartTooltip = Tooltip;

export { ChartContainer, ChartTooltip };
