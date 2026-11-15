# Scientific spatial Explorer

Phase 5 extends the existing persistent MapLibre map. It keeps the 80-fire lazy catalog, shared bundle reader, original polygons and four-corner RGB placement. Legacy v1 investigations retain their category renderer.

## Layers

- Fire perimeter: the supplied geographic boundary, with a subtle fill for interactive picking and the original outline. Hover/tap shows fire identity, year, supplied area and `polygon.geojson` provenance. Cells and GEDI have inspection priority; hide cells to inspect the underlying perimeter.
- Satellite RGB: the existing optional image source, positioned by the supplied top-left, top-right, bottom-right and bottom-left corners. No axis-aligned image approximation or new map is used.
- Recovery cells: the original GeoJSON polygons, identified by source `i`. Select modeled recovery, modeled canopy height, NDVI or relative model score. Changing metrics or timeline years updates feature state rather than resending polygon geometry.
- GEDI observations: a separate point layer. Inspection shows measured `rh98_m` in metres and source provenance, separately from modeled cell heights.
- Confidence zones: the shared Explorer controls now display the documented applicability export with verified/extrapolated treatments and separate model classifications; [Find Your Fire](find-your-fire.md) evaluates geographic intersections. See [confidence-methodology.md](confidence-methodology.md). The existing reference-forest overlay is not interpreted as confidence.

Cells, perimeter, image, reference forest and GEDI have independent visibility controls. Missing resources disable their controls. Switching fire clears the old layers, highlights, cell/timeline selection and scalar metric selection; the original map instance remains.

## Values and legend

The compact legend sits at the bottom-right of the uncovered map area, clear of the right panel and forecast bar. On mobile it sits above the bottom sheet. It shows the active metric, units, display range, source summer or timeline year, missing-data meaning and visible overlays.

Recovery is the supplied cell recovery ratio × 100, expressed as percent of reference forest height. Canopy height is modeled metres. NDVI is unitless in −1..1. Model score is the original 0..1 ranking score, never a calibrated probability. Score/NDVI use their documented numerical ranges. Height uses zero to the supplied maximum; recovery uses zero to at least 100%, extending to the supplied maximum. These are display ranges, not reliability thresholds. No values are interpolated or substituted.

Timeline values remain separate from source-summer values and the fire-level forecast. They come directly from `timeline.json → recovery_pct[yearIndex][i]`. An unavailable year produces missing values rather than showing another year. Selecting a scalar metric exits timeline display; disabling the timeline restores the selected source-summer metric.

Map and keyboard inspection share a readout containing the original cell index, row/column, values, units, fire id, summer and file/field provenance. Missing values say “Not supplied”. Keyboard grid positions without a supplied polygon say so explicitly. Timeline estimates are labeled modeled; GEDI is labeled measured.

## Verification

Tests cover scalar mappings for all 37 spatial datasets; nulls, zero and negative NDVI; source timeline indexing; units/provenance; unavailable controls; legend visibility; numeric GEDI height; interactive perimeter picking; independent cell visibility; feature-state updates without polygon replacement; and fire cleanup. Existing complete-catalog, v1 compatibility, RGB-corner and geometry tests remain enabled.

Full Phase 5 browser alignment and responsiveness are **NOT VERIFIED** while the browser automation host is unavailable. Automated source/coordinate checks do not establish visual acceptance. When available, verify at 1440×900 and mobile: each metric and its legend, rotated RGB alignment, perimeter inspection with cells hidden, cell/GEDI readouts, independent toggles, timeline interaction, navigation and switching spatial/perimeter-only fires.

No backend changes, simulated observations, inferred confidence geometry, new dependencies or automatic commits are introduced.
