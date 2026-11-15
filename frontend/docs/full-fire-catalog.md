# Complete supplied fire catalog

The bundle-v2 catalog now registers all 80 original source entries. The earlier [four-fire milestone](four-fire-examples.md) is superseded in scope; its reusable adapter, investigation components, timeline, forecast and persistent map remain in use.

## Loading and memory

- The importer copies only resources declared by each source index entry. The 406 original resources are unchanged. It also builds `perimeters.geojson` using the original perimeter coordinates, with catalog identity properties for filtering.
- Catalog browsing loads metadata and the lightweight perimeter collection, not 80 results, cell grids, images or timelines. Explorer renders the supplied locations and perimeters on the existing map.
- Selecting a fire loads its manifest, result and declared optional JSON resources through the shared loader. The selected image loads through the existing optical-image hook. No detail files are prefetched for other fires.
- The shared service retains at most three recently used fire exports. Cached selections refresh their recency; least-recently-used entries are evicted. Existing keyed requests, cancellation, error/retry states and URL selection remain in place.

## Discovery and availability

The existing Examples panel supports free-text identifier/year/region search, exact region and year filters, match counts and empty states. Original ids, coordinates, years and region codes are preserved. All 80 selection links use the existing shareable URL format and support reload/history through existing routing.

37 entries have spatial datasets; 43 have only a perimeter and summary. File declarations determine catalog capabilities rather than the `has_points` flag, which can be true on entries with no exported observation file. Once selected, actual validated resources determine enabled controls. No ranking score is turned into a probability or observation.

There are 37 cell/GeoJSON pairs, 37 RGB images, 37 GEDI files and 18 cell timelines. Some spatial datasets have no timeline or supported fire-level forecast. Each selected fire explains unavailable cells, timeline, imagery, observations or forecast. Missing grid layers and overlays are disabled with reasons. Summary-only fires retain their supplied summary, perimeter and any supplied fire-level forecast; they have no fabricated cell data or observations.

## Verification

Automated coverage includes all 80 selected-fire loads, all 37 spatial datasets, all source perimeter geometries, lazy network requests, bounded cache eviction, resource absence, unavailable controls, search, URL round-trips and catalog-layer cleanup. Existing four-fire scientific-value/geometry tests and v1 fixture tests remain enabled. `npm run check` runs formatting, TypeScript, ESLint, tests and all data validators; `npm run build` produces the production bundle.

Manual visual acceptance of the complete catalog should cover Explorer perimeter/marker alignment; selecting a spatial fire and a summary-only fire; switching between regions; no-match filters; deep-link reload and Back/Forward; mobile panel scrolling; optional layers; and cell timeline reset. Earlier BC-only visual verification does not establish full-catalog visual acceptance.

The Phase 4 browser attempt returned `Browsers: Error: The browser access host is unavailable`. Full-catalog visual acceptance is **NOT VERIFIED**.

Reimport with `node scripts/import-fire-examples.mjs <supplied-frontend_katya-directory>`. Validate with `npm run data:demo`. No backend modifications, new scientific calculations or automatic commits are required.
