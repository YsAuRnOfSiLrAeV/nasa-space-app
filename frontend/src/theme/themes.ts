/**
 * Theme registry. The visual definition of each theme lives only in
 * src/styles/themes/<id>.css; this file just lists them for the UI and the
 * bootstrap script in index.html (keep that list in sync; a test checks it).
 *
 * Earth Intelligence is the only active theme. Research Lab and Living Atlas
 * are kept, unbuilt, in archive/ (see archive/README.md to restore one).
 */
export const THEMES = [
  {
    id: 'earth-intelligence',
    label: 'Earth Intelligence',
    mode: 'dark',
    description: 'Earth observation: lit dotted globe, mint, burgundy burn and violet on black',
    swatch: ['#0b0b0e', '#9fd5c8', '#b53e5d'],
  },
] as const;

export type Theme = (typeof THEMES)[number];
export type ThemeId = Theme['id'];

export const DEFAULT_THEME: ThemeId = 'earth-intelligence';
export const THEME_STORAGE_KEY = 'fre-theme';

export function isThemeId(value: unknown): value is ThemeId {
  return THEMES.some((t) => t.id === value);
}

export function getTheme(id: ThemeId): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

/** Every theme file must define all of these (enforced by themes.test.ts). */
export const REQUIRED_THEME_VARS = [
  // shadcn semantic colors
  'background',
  'foreground',
  'card',
  'card-foreground',
  'popover',
  'popover-foreground',
  'primary',
  'primary-foreground',
  'secondary',
  'secondary-foreground',
  'muted',
  'muted-foreground',
  'accent',
  'accent-foreground',
  'destructive',
  'border',
  'input',
  'ring',
  // domain colors
  'highlight',
  'faint',
  'rule',
  'forest',
  'satellite',
  'burn',
  'burn-text',
  'select',
  'mint',
  'silver',
  'stage-0',
  'stage-1',
  'stage-2',
  // identity: instrument signal, study region, navy plate, panel hairline
  'signal',
  'amber',
  'navy',
  'rule-strong',
  'chart-1',
  'chart-2',
  'chart-3',
  'chart-4',
  'chart-5',
  // typography: one family token per role
  'font-display', // display headings
  'font-section', // section headings
  'font-ui', // interface / body text
  'font-prose', // explanatory prose
  'font-label', // technical labels
  'font-numeric', // large numerical measurements
  'font-coord', // coordinates and timestamps
  'font-data', // tabular data and chart ticks
  'display-size',
  'display-weight',
  'display-tracking',
  'display-leading',
  'display-transform',
  'eyebrow-font',
  'eyebrow-weight',
  'eyebrow-tracking',
  'eyebrow-transform',
  'eyebrow-style',
  'eyebrow-size',
  'figure-size',
  'figure-weight',
  'figure-tracking',
  // shape & layout
  'radius',
  'panel-width',
  'panel-bg',
  'panel-shadow',
  'section-gap',
  'chart-height',
  'chart-grid-dash',
  'chart-reference',
  'chart-point-opacity',
  // atmosphere & decorative details
  'app-backdrop',
  'map-overlay',
  // map (read by src/components/map/mapTheme.ts)
  'map-background',
  'map-water',
  'map-water-opacity',
  'map-waterway',
  'map-road',
  'map-road-opacity',
  'map-boundary',
  'map-label',
  'map-water-label',
  'map-label-halo',
  'map-imagery-opacity',
  'map-imagery-saturation',
  'map-imagery-brightness',
  'map-imagery-contrast',
  'map-hillshade-exaggeration',
  'map-hillshade-shadow',
  'map-hillshade-highlight',
  'map-water-label-italic',
  'map-point-stroke',
  'map-point-scale',
  'map-control-icon-filter',
] as const;
