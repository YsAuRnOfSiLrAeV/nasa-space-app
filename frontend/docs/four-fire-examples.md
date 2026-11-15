# Four real fire examples

This records Milestone 2. [The complete 80-fire catalog](full-fire-catalog.md) now supersedes its four-fire import limit.

Milestone 2 reuses the bundle v2 adapter, StudyDataApi, investigation components and persistent MapLibre controller. No new renderer or map is introduced. The importer allowlists exactly four source index entries and copies each entry's eight declared resources without changing them. No other fires are imported.

| Source id        | Cell polygons | Supplied fire forecast, 2026 |
| ---------------- | ------------: | ---------------------------: |
| bc_2003_490      |          3154 |                       0.4436 |
| quebec_1995_1218 |          6533 |                       0.8382 |
| quebec_2010_557  |          2738 |                       0.5118 |
| ontario_1988_21  |          3051 |                       0.8313 |

These are growth-model estimates relative to reference forest, not observations or ranking scores. The unchanged source files remain authoritative. The existing [field mappings](bc-bundle-v2.md) apply to all four fires. Each fire loads its own perimeter, exact cell polygons and identifiers, rotated RGB image, measured GEDI observations, modeled cell timeline, fire-level series and uncertainty bounds.

The real Examples cards replace the corresponding documentation/development cards. Legacy v1 data remains on disk and supported by configurations without bundleBaseUrl. Switching fire clears the inspected cell, fire-level forecast year and cell timeline year. Resource requests remain keyed and cancelled by the existing resource hook; the fire-keyed map overlay component clears its layers on unmount. Layer preferences remain user preferences, while unavailable imagery and observations are removed.

Regression checks cover all four source-derived cell counts and forecasts, original cell geometry and picking, GEDI coordinates, image dimensions/corners, complete timeline matrices and forecast series. Shared-service switching includes returning to BC. Controller tests replace all four scenes on one controller, clear highlights and sources, and exercise missing overlays. Every fire is also tested with omitted optional cells, imagery, GEDI and timeline files. Declared-but-missing resources remain errors; missing scientific values remain missing. Existing v1 tests remain in the full check.

Browser status: **NOT VERIFIED**. The attempt reported `Browsers: Error: The browser access host is unavailable`. Desktop/mobile visual acceptance, actual WebGL alignment and interactive navigation are not claimed.

When browser access is restored, run the frontend and verify at 1440×900:

1. Enter Examples from Globe, then select BC → Quebec 1995 → Quebec 2010 → Ontario 1988 → BC. Confirm one continuous map and each fire's own camera position, perimeter, cell polygons and measured GEDI points.
2. Enable satellite imagery for each fire; check its rotated image aligns with its own perimeter and cells. Pick a cell and compare its source row/col and modeled height.
3. Enable the cell timeline and move years; verify modeled map values change. Select another fire and confirm timeline is disabled and no cell remains selected. Return to the previous fire and confirm its state is reset too.
4. Check each supplied forecast and 80% interval independently from the cell timeline. Test layer toggles, legend, Back/Forward, deep-link reload and mobile panel behavior.
5. Use a test bundle omitting optional resources and verify unavailable layers disappear without displaying another fire's data.

No backend changes, new dependencies, fabricated observations, additional fires or automatic commits are part of this milestone.
