import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import ui from '@/components/shell/primitives.module.css';

/**
 * How a series is drawn, so its key looks like its marks:
 * - `dot`, `ring`: filled or hollow point;
 * - `line`, `dashed`: solid or dashed line;
 * - `tick`: a short vertical rule (an event such as the fire year);
 * - `diamond`: a satellite;
 * - `change`: one colour turning into another (`color` → `to`).
 */
export type Swatch = 'dot' | 'ring' | 'line' | 'dashed' | 'tick' | 'diamond' | 'change';

export interface LegendItem {
  swatch: Swatch;
  /** CSS colour, usually a theme variable such as `var(--burn)`. */
  color: string;
  /** Second colour, for `change`. */
  to?: string;
  label: ReactNode;
}

/**
 * Key to a chart or a drawing. Identity is never colour alone: each item has a
 * label, and the swatch repeats the mark's shape. `micro` is the small
 * uppercase style used above charts; `plain` is reading-size text.
 */
export function ChartLegend({
  items,
  tone = 'micro',
  className,
}: {
  items: LegendItem[];
  tone?: 'micro' | 'plain';
  className?: string;
}) {
  return (
    <ul
      aria-label="Legend"
      className={cn(
        tone === 'micro'
          ? cn(ui.micro, 'flex flex-wrap gap-x-5 gap-y-2 text-[9px]')
          : 'space-y-2 text-[0.8125rem] leading-snug text-foreground',
        className,
      )}
    >
      {items.map((item, i) => (
        <li key={i} className={cn('flex items-center', tone === 'micro' ? 'gap-2' : 'gap-3')}>
          <SwatchMark {...item} wide={tone === 'plain'} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

function SwatchMark({
  swatch,
  color,
  to,
  wide,
}: Pick<LegendItem, 'swatch' | 'color' | 'to'> & { wide: boolean }) {
  // On reading-size keys every swatch sits in the same box, so the labels align.
  const box = wide ? 'flex w-7 shrink-0 items-center justify-center' : 'flex shrink-0 items-center';
  const mark = (() => {
    switch (swatch) {
      case 'dot':
        return <span className="size-2 rounded-full" style={{ background: color }} />;
      case 'ring':
        return <span className="size-2 rounded-full border" style={{ borderColor: color }} />;
      case 'line':
        return <span className="h-0.5 w-4" style={{ background: color }} />;
      case 'dashed':
        return <span className="w-4 border-t-2 border-dashed" style={{ borderColor: color }} />;
      case 'tick':
        return <span className="h-3 w-px" style={{ background: color }} />;
      case 'diamond':
        return <span className="size-[7px] rotate-45" style={{ background: color }} />;
      case 'change':
        return (
          <span className="flex w-7 items-center justify-between">
            <span className="size-2 rounded-full" style={{ background: color }} />
            <span className="h-px w-2 bg-(--rule)" />
            <span className="size-2 rounded-full" style={{ background: to }} />
          </span>
        );
    }
  })();
  return (
    <span aria-hidden className={box}>
      {mark}
    </span>
  );
}
