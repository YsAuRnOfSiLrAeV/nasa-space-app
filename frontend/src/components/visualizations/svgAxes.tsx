import type { ReactNode } from 'react';
import type { ScaleLinear } from 'd3-scale';

const LABEL_STYLE = { fontFamily: 'var(--font-data)' } as const;

/**
 * Horizontal grid lines with value labels on the left, for hand-drawn SVG
 * charts: recessive dashed rules in the theme's rule colour.
 */
export function YGrid({
  scale,
  ticks,
  left,
  right,
  format,
}: {
  scale: ScaleLinear<number, number>;
  /** Approximate tick count, passed to `scale.ticks`. */
  ticks: number;
  /** x of the plot's left and right edges. */
  left: number;
  right: number;
  format: (value: number) => string;
}) {
  return (
    <>
      {scale.ticks(ticks).map((t) => (
        <g key={t}>
          <line
            x1={left}
            x2={right}
            y1={scale(t)}
            y2={scale(t)}
            stroke="var(--rule)"
            strokeDasharray="var(--chart-grid-dash)"
          />
          <AxisText x={left - 6} y={scale(t)} dy="0.32em" anchor="end">
            {format(t)}
          </AxisText>
        </g>
      ))}
    </>
  );
}

/** A small axis label in the data font. */
export function AxisText({
  x,
  y,
  dy,
  anchor = 'middle',
  size = 9,
  emphasis = false,
  children,
}: {
  x: number;
  y: number;
  dy?: string;
  anchor?: 'start' | 'middle' | 'end';
  size?: number;
  /** Selected item: full-strength colour and semibold. */
  emphasis?: boolean;
  children: ReactNode;
}) {
  return (
    <text
      x={x}
      y={y}
      dy={dy}
      textAnchor={anchor}
      fontSize={size}
      fill={emphasis ? 'var(--foreground)' : 'var(--muted-foreground)'}
      fontWeight={emphasis ? 600 : undefined}
      style={LABEL_STYLE}
    >
      {children}
    </text>
  );
}
