/**
 * The theme contract. Earth Intelligence is the app's one theme, set statically
 * on <html data-theme> in index.html; its values live only in
 * src/styles/themes/earth-intelligence.css. Research Lab and Living Atlas are
 * kept, unbuilt, in archive/ (see archive/README.md).
 */
export const THEME_ID = 'earth-intelligence';

/** The theme file must define exactly these (enforced by themes.test.ts). */
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
  // fire grid categories on the map (src/components/fire)
  'grid-stage-0',
  'grid-stage-1',
  'grid-stage-2',
  'grid-prob-0',
  'grid-prob-1',
  'grid-prob-2',
  'grid-outside',
  'grid-zone',
  'evidence-optical',
  'evidence-model',
  'evidence-gedi',
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
  'map-land',
  'map-land-line',
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
