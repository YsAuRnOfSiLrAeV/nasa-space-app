# Frontend design guide

## Purpose and source of truth

The Forest Recovery Explorer explains why optical greenness and forest structure
can recover at different rates. Keep measured observations, model estimates,
forecasts and conceptual illustrations visibly distinct. Missing data stays missing.
See [Product](../PRODUCT.md) for the audience and product principles and
[README](../README.md) for setup, data contracts and backend integration.

This is an independent project, not an official NASA application. Prefer clear
scientific figures, restrained typography and meaningful color over branding or
decorative effects. CSS and component code define the current implementation;
this guide records the rules for maintaining it.

## Styles, tokens and typography

The stylesheet entry is `src/styles/index.css`. It imports framework and font
styles, tokens, the Earth Intelligence theme, global styles, shared component and
page styles, then the paper-page overrides. Preserve this cascade order.

| Source                                                             | Responsibility                                  |
| ------------------------------------------------------------------ | ----------------------------------------------- |
| `src/styles/tokens.css`                                            | Map semantic tokens to utilities                |
| `src/styles/themes/earth-intelligence.css`                         | Dark theme values and typography                |
| `src/styles/themes/paper.css`                                      | Light reading sections scoped to `.nasa-page`   |
| `src/styles/global.css`                                            | Shared base rules and third-party DOM styling   |
| `src/styles/nasa-components.css`                                   | Shared panels, headers, metrics and badges      |
| `src/styles/nasa-page-layout.css`                                  | Page containers, grids, spacing and print rules |
| `src/compositions/earth-intelligence/ScientificLanding.module.css` | Scoped landing figure palette and layout        |

Use semantic CSS variables rather than copying color values into components.
The dark theme uses a neutral near-black ground and off-white text. Signal blue
marks actions, selection and observations; amber identifies study-region or fire
investigation marks. Burgundy represents burns in the shared domain palette.
The landing has its own scoped cartography palette; preserve existing chart and
stage encodings when changing surrounding UI.

The current theme uses Geist for display, interface and prose, with JetBrains Mono
for coordinates and data. Fonts are self-hosted through `@fontsource` imports.
Other imported families support earlier typography; their presence does not make
them the current design specification. Use the theme's font-role tokens and
tabular numerals for aligned readouts.

Prefer square corners, hairlines, flat fills and a consistent spacing rhythm based
on 4px increments. Avoid decorative gradients, glows and shadows. Keep each color's
meaning consistent and accompany color with labels, shapes or patterns.

## Reusable page and component patterns

Reuse the shell components under `src/components/shell/` before creating a parallel
navigation, loading state or page wrapper. The globe workspace stays dark;
document pages use a dark navigation/intro band and white reading sections.

| Pattern                     | Existing classes                                                          |
| --------------------------- | ------------------------------------------------------------------------- |
| Page and content column     | `.nasa-page`, `.nasa-page-scroll`, `.nasa-main-content`                   |
| Intro and section hierarchy | `.nasa-page-header`, `.nasa-section`, `.nasa-section-header`              |
| Data and metric containers  | `.nasa-panel`, `.nasa-content-block`, `.nasa-metric`                      |
| Responsive grids            | `.nasa-grid-container`, `.nasa-grid-2`, `.nasa-grid-3`, `.nasa-card-grid` |
| Text and visual pairing     | `.nasa-two-column`, `.nasa-two-column-text`, `.nasa-two-column-visual`    |
| Main column and sidebar     | `.nasa-with-sidebar`, `.nasa-main-column`, `.nasa-sidebar`                |
| Grouping                    | `.nasa-stack`, `.nasa-inline-group`, `.nasa-flex-between`                 |
| Supporting content          | `.nasa-badge`, `.nasa-feature-row`, `.nasa-timeline`                      |
| Spacing                     | `.nasa-space-*`, `.nasa-gap-*`, `.nasa-pad-*`, `.nasa-px-*`, `.nasa-py-*` |

Read the actual CSS for variants, dimensions and breakpoints rather than duplicating
its declarations in documentation. Layouts should stack on narrow screens, retain
readable chart labels and avoid horizontal overflow. Page layout rules include
640px, 1024px and 1440px adaptations; individual components may use other thresholds.

## Scientific cartography and illustration

The landing uses geographic land plates, coastlines, a graticule, monospace
annotations and an editorial headline. Natural Earth land polygons and the supplied
study locations provide geographic context; these visuals do not establish terrain
elevations, forest coverage or measured canopy geometry.

- `ContourGround.tsx` and `planet/contours.ts` draw seeded decorative contours.
  Keep the visible "not measured terrain" caveat; do not give them measured elevations.
- `ObservationWindow.tsx` shows a Landsat natural-color scene from the recovery
  record for `2002_205_-376`, with its geographic extent and leader lines. If the
  record is absent, omit both the window and the geographic mark.
- `ObservationSchematic.tsx` compares equal greenness with different stand
  structure. Keep its schematic and conceptual-illustration labels on the figure.
- `planet/drawSatellites.ts` illustrates NISAR, Landsat and the ISS carrying GEDI.
  Mission inclinations come from `src/data/missions.ts`; orbital radius, node,
  speed and phase are illustrative, not live tracking. Preserve that disclosure.
- Documentation-example fires use dashed outlines. Fire markers are square and
  keyboard accessible. Keep orientation, source disclosure and scientific caveats.

The landing's `--cartography-*` tokens provide ground, ink, muted text, rules,
actions and observations. Shared figure classes include `scientificPlate`,
`sectionRule`, `coordinate`, `figureIndex` and `figureCaption`; they provide layout,
not scientific measurements. Apply canvas opacity through the canvas context when
using OKLCH colors; older alpha helpers and shared map code expect hex values.
Preserve the even-odd land-fill rule so polygon holes remain visible.

Narrow desktops drop the right annotation column; below 1024px the datum, column
and leaders are hidden and the lead moves beneath the globe. Check short viewports
as well as narrow ones. Reduced-motion poses must retain useful figure content.

## Map shell behavior to preserve

Hash state separates `intro`, `explore` and `fire` presentation from `examples`
and `search` modes. A fire ID opens its result. Legacy fire, analysis and recovery
addresses remain supported by `src/app/route.ts`.

The investigation panel distinguishes loading, empty and error states. Backend
health alone does not prove that a processing endpoint exists; show processing
availability honestly. Label example exports, mock results and missing observations.

Mode changes clear active fire selection while retaining the latest mounted result
and its loaded data. URL changes and panel collapse must not reset cameras.
Explicit Explore, Back to Globe, fire selection and study-tool actions own camera
transitions. Camera coordinates are not serialized into the URL.

The study map and fire-detail renderer retain separate cameras. Clearing a fire
reveals the study camera; reopening the same cached fire retains its detail view.
Preserve Research and Recovery routes and keyboard focus when returning to the map.

## Accessibility and validation

Use semantic headings and controls, visible keyboard focus, sufficient contrast,
and labels beyond color. Aim for WCAG 2.2 AA and at least 44px touch targets on
coarse pointers. Honor reduced motion and high-contrast preferences. These are
requirements to verify, not a blanket claim of compliance.

Run the relevant checks from `frontend/`: `npm run check` covers formatting,
TypeScript, lint, unit tests and data validation; `npm run build` checks production
output. The example `public/data/demo/bc_2003_490/cells.json` is intentionally
compact JSON. Preserve its values and use `npm run data:demo` to validate it.
`public/data/` is excluded from Prettier so normal formatting keeps it compact.

For visual or interaction changes, also inspect desktop, mobile and short-screen
layouts, direct links, refresh/history, panel collapse, fire selection, camera
persistence, keyboard navigation and missing/backend-error states. Earlier reports
left matched desktop/mobile screenshots and live camera/history regression checks
incomplete because browser capture was unavailable. Those checks remain pending;
old automated pass counts do not constitute current visual sign-off.
