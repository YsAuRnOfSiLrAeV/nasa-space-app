/**
 * Non-visual labels shared by the legend and charts.
 * Colors are NOT defined here: they come from the active theme's CSS variables
 * (Tailwind utilities like `bg-stage-0`, or `var(--stage-0)` in SVG/Recharts;
 * MapLibre reads them via src/components/map/mapTheme.ts).
 */
import type { Stage } from '../data/schema';

export const STAGE_LABELS: Record<Stage, string> = {
  0: '< 5 m',
  1: '5–10 m',
  2: '≥ 10 m',
};

/** Tailwind classes per stage (literal strings so Tailwind can detect them). */
export const STAGE_BG: Record<Stage, string> = {
  0: 'bg-stage-0',
  1: 'bg-stage-1',
  2: 'bg-stage-2',
};
