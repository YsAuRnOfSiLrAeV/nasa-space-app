# Frontend architecture

The app loads its map when the workspace first opens, then keeps that map mounted
and exposes it through `StudyMapController`.
Components express intent through the controller rather than holding a second
MapLibre instance. The URL owns map mode, presentation and selected fire.

## Dependency boundaries

- `data/`: file schemas, validation contracts and supplied research evidence.
- `domain/`: DOM-free fire, forest, study and globe logic. No React, map-library,
  component, hook or service imports. Geography formatters live here too.
- `services/`: injected data/API access, file parsing, image probing and caching.
- `hooks/`: React state, asynchronous orchestration and interaction subscriptions.
- `components/`: presentation and browser/map UI integration.
- `compositions/`: page-level feature assembly.
- `pages/`: route-level presentation.
- `features/`: an option for substantial isolated features; small features can stay
  in the existing layers. No repository-wide migration is required.

These are working conventions rather than a requirement to split every small
feature across folders. Existing modules permit direct imports; an index file is
not a mandatory public API.

ESLint rejects UI imports from domain and service modules. Browser image decoding
is a small injected service adapter; the main data service remains DOM-free.
`PlanetHero.module.css` owns globe marker styling rather than importing a page's CSS.

## Resource loading

Data hooks return `{ state, retry }`. The shared `Resource<T>` union distinguishes
`idle`, `loading`, `absent`, `error` and `ready`. `null` keys mean idle; a successful
load with no value means absent. Zero and false are valid data.

`useResource` owns the current key and retry generation. Its tested request helper
aborts superseded work, suppresses late completions even when a loader ignores the
signal, and converts load failures into reader-facing errors. Fresh function
identities do not restart requests; include all data-selection inputs in the key.
View components translate resource states into their own loading and empty copy.

Study data, fire exports, the catalog, recovery records, backend health, land dots,
land outlines and optional optical probes use this state machine. Outline failure
is exposed as an error state while the globe can still display study locations.

## Cache ownership

`StudyDataApi` caches validated fire exports for the current service instance.
All callers share that cache; `useFireData` only reads it. A retry requests
`loadFire(id, signal, { fresh: true })`. `clearFireCache(id?)` invalidates one or all
exports. Request versions prevent a late older response from replacing a fresh
export, and aborted requests cannot populate the cache.

Optional image decoding goes through `imageLoads`, with an injected probe. The
browser adapter cleans up event and abort handlers on completion or cancellation.

## Fire investigation

`useFireInvestigation` owns fire data, active layer, overlays, image status,
inspected cell and forecast year. Switching or closing a fire clears the cell and
year; layer/overlay preferences remain shared. Inspecting a cell moves the camera
only through an explicit action.

The composition arranges the map, panel and year bar from that one state object.
`InvestigationPanel` composes `FireCatalogList` or `FindYourFireNotice`.
`FireInvestigation` keeps its summary facts and loading/provenance messages inline,
and composes the results, controls, legend and inspector. Availability rules keep unavailable overlays off.

`FireResults` composes separate observed-state and forecast sections. Stage shares,
comparison and metadata each have their own component. No view calculates its own
alternative fire forecast: `domain/fire/growthForecast.ts` defines the age-based
equation and validates it against the supplied milestones. The normalized research
illustration uses the same equation. Its scientific approval status is unchanged.

Legacy standalone Fire/Analyze pages and their conflicting recovery-anchored
forecast have been removed. Legacy addresses still resolve through `app/route.ts`
to the shared map workflow.

## Map integration and camera intent

`FireGridMapProps` lists only the data and display inputs the grid needs. It does
not depend on the complete investigation hook return type. `FireGridController`
limits its map access to grid layers, highlights, overlays and pointer events.

`domain/fire/fireGrid.ts` owns the existing pixel classification, row-major cell
indexing, geographic transforms, outlines and cell descriptions. `gridPicking.ts`
resolves a coordinate or GEDI hit to a categorical description without browser or
MapLibre dependencies. `gridRasterImage.ts` only encodes those pixels using the
browser canvas, preserving dimensions and pixel order.

`useFireGridLayers` owns raster memoization and the existing controller lifecycle.
`FireGridMap` keeps pointer subscriptions, pinning, Escape dismissal and inspector
synchronization beside the tooltip they drive.
MapLibre event translation remains in `StudyMapController`.

Route parsing, hash updates and history remain in the routing/composition layers.
`useFireCamera` receives selection/presentation inputs and schedules one flight per
selection on the existing map, preserving the grid-bounds and failed-load fallback
paths. It cancels pending frames and does not write URLs. Forecast, overlay and
inspector changes do not initiate selection flights.

## Research chapters

`ResearchPage` composes the introduction, chapter bar and five named chapters.
Each chapter owns its principal figure and supporting evidence. `ResearchPage`
owns its selected Ontario group and missing-data boundary; supporting study figures
are separate components. Copy and evidence remain in `chapters.ts` and
`data/calibrationEvidence.ts`.

Height accuracy and forecast validation share `BarPanel`, `BarRow` and `BarScale`,
including marker rendering. Scientific values, units and uncertainty caveats stay
with their respective figures.

## Verification

Run `npm run check` and `npm run build`. Regression tests cover resource cancellation
and staleness, cache refresh ordering, image-probe cleanup, per-fire selection
resets, grid categories and result/research rendering. Browser checks are still
needed for camera continuity, input interactions and responsive layouts.
