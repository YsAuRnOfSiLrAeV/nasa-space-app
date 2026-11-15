# Targeted frontend map changes

Historical record of the map extraction. The later simplification merged pointer
state back into `FireGridMap`; see `architecture.md` for the current structure.

## Responsibilities and changed files

| File                                                                   | Responsibility                                                                                                                      |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/fire/FireGridMap.tsx`                                  | Explicit component props and tooltip presentation; no dependency on the entire investigation hook return type.                      |
| `src/components/fire/fireGridController.ts`                            | Narrow controller capability interface for grid integration.                                                                        |
| `src/domain/fire/gridPicking.ts`                                       | Pure geographic/GEDI hit resolution and categorical descriptions, using the existing cell-index mathematics.                        |
| `src/components/fire/gridRasterImage.ts`                               | Canvas encoding only; preserves row-major pixel order, dimensions and PNG format.                                                   |
| `src/hooks/useFireGridLayers.ts`                                       | Raster memoization, controller scene updates, overlays, inspected-cell highlight and cleanup.                                       |
| `src/hooks/useFireGridPointer.ts`                                      | Pointer subscription, pinned tooltip state, Escape dismissal, active-layer description and inspector selection callback.            |
| `src/hooks/useFireCamera.ts`                                           | Existing selection-flight effects, pending-frame cancellation, whole-Earth entry and failed-load catalogue-centre fallback.         |
| `src/compositions/earth-intelligence/EarthIntelligenceComposition.tsx` | Supplies explicit grid/camera inputs; retains route updates and feature assembly.                                                   |
| `src/domain/fire/gridPicking.test.ts`                                  | Cell-centre/category round trips, outside/null coordinates, invalid GEDI hits and GEDI precedence across the four supplied exports. |
| `src/components/fire/gridRasterImage.test.tsx`                         | Non-square pixel orientation and canvas-unavailable fallback.                                                                       |
| `docs/architecture.md`                                                 | Existing layer conventions and the map/camera boundaries.                                                                           |
| `docs/targeted-map-review.md`                                          | Scope and validation record.                                                                                                        |

The existing pure pixel generation, four-corner geographic transforms, cell rings,
and outlines already lived in `domain/fire/fireGrid.ts`; they were retained without
formula changes. MapLibre event translation and map ownership remain in the existing
controller. There are no new maps, dependencies, backend changes or URL changes.
Existing unrelated working-tree changes were retained. Nothing was committed.

## Validation

- `npm run check`: passed, including formatting, TypeScript, ESLint, all **317 tests
  in 43 files**, generated-data checks, map-style validation, fixture validation and
  demo validation.
- `npm run build`: passed (TypeScript and Vite production build).
- Six new tests cover raster encoding and pure picking. Existing controller and
  routing tests also passed. These do not establish browser behavior.
- The four exports pass schema/data validation: British Columbia 2003 documentation
  example, Quebec 1995 development fixture, Quebec 2010 development fixture and
  Ontario 1988 development fixture. Three are synthetic fixtures, not calibrated
  team exports.

## Browser acceptance status

Computer Use stopped the browser attempt because it could not determine the current
Edge URL on Windows confidently enough to enforce policy. No browser acceptance
item is claimed as passed:

| Requested check                                     | Status                                       |
| --------------------------------------------------- | -------------------------------------------- |
| Open each of the four fires                         | Not browser-verified; data validation passed |
| Direct URLs and Back/Forward                        | Not browser-verified                         |
| Camera transitions and map persistence              | Not browser-verified                         |
| Raster alignment, overlays and cell picking         | Not browser-verified                         |
| Forecast slider stability                           | Not browser-verified                         |
| Keyboard cell inspector and pointer synchronization | Not browser-verified                         |
| Landing and Research navigation                     | Not browser-verified                         |

No behavior differences are intended. The original camera timings, selection guards,
effect dependencies, raster corners, palette generation, overlay updates, tooltip
placement and inspector callback behavior were preserved. Runtime equivalence remains
unconfirmed until the browser checklist can be completed.
