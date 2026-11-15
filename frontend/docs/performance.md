# Performance measurements

Measured on 15 November 2026 using production builds on the same machine and the
same data. Values are bytes, with decimal KB/MB used in summaries. The baseline
was the working tree immediately after the architecture refactor.

## Before and after

| Metric                          |    Before |   After | Reduction |
| ------------------------------- | --------: | ------: | --------: |
| Initial static JavaScript graph | 1,947,322 | 530,203 |       73% |
| Initial JavaScript, summed gzip |   560,321 | 172,246 |       69% |
| Initial CSS                     |   202,631 | 125,401 |       38% |
| Initial CSS, summed gzip        |    37,157 |  25,821 |       31% |
| All emitted font files          |        36 |      10 |  26 files |
| All emitted font bytes          |   643,996 | 160,636 |       75% |

These are build-artifact measurements, not browser network-transfer or load-time
measurements. The script traverses the Vite manifest's static imports from
`index.html`, including their CSS, and compresses each file with Node's gzip.
Dynamic imports are excluded. Font totals describe emitted assets; browsers select
font subsets according to the characters actually rendered.

## Changes

- The above-fold canvas globe remains eager. The hidden MapLibre map, its worker,
  styles and tile requests wait until a workspace opens. The map then stays mounted
  across page and mode changes. Direct fire/workspace links request it immediately;
  the study action can open the workspace before the map code has loaded, with a
  loading status while it arrives and the camera flight once it is ready.
- Regional UI is a dynamic import. The study analysis and chart code are in a
  separate module, mounted only when the user opens its disclosure. Once opened,
  the tools remain mounted so subsequent toggles preserve their state.
- Automatic entry-aware chunk splitting replaces manual vendor groups that pulled
  common helpers and the chart bundle into the initial dependency graph. Recharts
  is now in an optional shared chunk, outside the initial graph.
- Only the active Geist and JetBrains Mono font families emit CSS/assets; their
  existing glyph coverage and `font-display: swap` are retained.
- Globe palette reads use one computed-style snapshot per frame rather than 16
  separate `getComputedStyle` calls. Leader geometry is cached between layout
  changes: regression tests update 120 sets of drifting anchors with only one read
  of each of the three bounding rectangles. Resize/font/layout events invalidate
  the cached geometry. Fire markers move with transforms instead of top/left.
- Locator land dots wait until regional exploration actually needs them.

## Reproduce

```sh
npm run build
npm run perf:bundle
npm run check
```

The build emits `dist/.vite/manifest.json`. To save a measurement snapshot:

```sh
node scripts/measure-bundle.mjs .cache/performance-after.json
```

## Verification limits

The production build and full checks pass, including 311 tests and data validators.
Browser profiling was unavailable because the browser access host could not be
reached. LCP, INP, CLS, FPS, device CPU time and perceived responsiveness were not
measured, and no improvements to those metrics are claimed. Confirm first map
entry, camera retention, marker alignment, disclosure interaction and mobile/slow
network behavior in a real browser before deployment.
