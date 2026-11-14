# Phase 1 implementation report

Implemented in `nasa-space-app/frontend/`. No commits, backend changes,
dependencies, data-contract changes or scientific-calculation changes.

## Result

- Root opens the existing intro composition. Landing layout, headline,
  typography, globe, annotations and animation source are unchanged.
- Hash parameters store presentation, mode and selected fire. Legacy fire,
  analyze, Research and Recovery routes remain supported.
- Shared header exposes Examples, Find Your Fire and How We Researched.
- Exploration and fire states expose a collapsible investigation panel.
  Catalog loading, errors and empty data are distinct. Search shows real
  backend health and does not imply a processing endpoint exists.
- Existing FireRecovery opens inside the Map shell without replacement.
  Switching workflows clears active fire selection while retaining the most
  recent mounted detail renderer and loaded exports.
- Mode/URL changes and collapse do not invoke camera fitting. Explicit Explore,
  fire selection, Back to Globe and existing study actions own transitions.
- Research content, Recovery functionality and existing optional illustration
  routes remain. No new 3D visualization was implemented.

## Changed files

| Area                        | Files                                                                                                                                                                                                            |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Routing and state           | `src/app/App.tsx`, `src/app/route.ts`, `src/app/mapNavigation.ts`, `src/app/route.test.ts`, `src/app/mapState.test.ts`                                                                                           |
| Shared navigation and focus | `src/components/shell/SiteHeader.tsx`, `src/components/shell/SiteNav.tsx`, `src/components/shell/nav.module.css`, `src/components/shell/PageLayout.tsx`                                                          |
| Map composition             | `src/compositions/types.ts`, `src/compositions/earth-intelligence/EarthIntelligenceComposition.tsx`, `src/compositions/earth-intelligence/useEarthView.ts`, `src/compositions/earth-intelligence/RegionView.tsx` |
| Investigation panel         | `src/compositions/earth-intelligence/InvestigationPanel.tsx`, `src/compositions/earth-intelligence/MapShell.module.css`, `src/compositions/earth-intelligence/mapShell.test.tsx`                                 |
| Loading and integration     | `src/hooks/useBackendStatus.ts`, `src/hooks/useFireData.ts`, `src/pages/fire/FirePage.tsx`                                                                                                                       |
| Test discovery              | `vite.config.ts` now also discovers TSX UI tests                                                                                                                                                                 |
| Documentation               | `UNIFIED_MAP_SHELL_PLAN.md`, `UNIFIED_MAP_SHELL_REPORT.md`                                                                                                                                                       |

`PlanetView.tsx`, `PlanetHero.tsx`, `LandingOverlays.tsx`,
`ScientificLanding.module.css`, `StudyMap.tsx`, `FireMap.tsx`, `FireRecovery.tsx`
and scientific calculation code were not changed by this implementation.

## Checks

| Check                              | Result                                                          |
| ---------------------------------- | --------------------------------------------------------------- |
| TypeScript                         | Passed                                                          |
| ESLint                             | Passed                                                          |
| Unit tests                         | 250 passed across 33 files                                      |
| Study-data validation              | Passed: 282 points                                              |
| Globe-data validation              | Passed: 3,156 land dots                                         |
| Landsat validation                 | Passed: 23 images, 31 NDVI years                                |
| Basemap validation                 | Passed: 28 layers                                               |
| Demo export validation             | Passed: one documentation example                               |
| Production build                   | Passed                                                          |
| Formatting of implementation files | Passed                                                          |
| Combined `npm run check`           | Passed in the follow-up validation run                          |
| Desktop/mobile browser regression  | Incomplete: browser host unavailable and native input conflicts |

The follow-up validation run corrected formatting only in
`src/components/ui/button.tsx`, `src/styles/NASA_DESIGN_IMPLEMENTATION.md`,
`src/styles/NASA_ENHANCED_STYLING.md`, `src/styles/NASA_PAGE_LAYOUT_SYSTEM.md`
and `src/styles/nasa-design-system.md`. No behavior or scientific content was changed.
The complete combined command now passes, and the production build passes.

## Screenshots and remaining verification

The real-browser desktop baseline was captured before implementation:
`artifacts/unified-map-shell/landing-desktop-before.png`.

The first run stopped with physical Escape. Browser verification was resumed
at the user's request. The browser access host remains unavailable. Native
automation repeatedly reported user input, changed bounds and minimized windows;
some screenshots showed the foreground application instead of the selected
browser. Attempts to activate and refresh the selected window did not resolve
the conflicts. A foreground browser availability question is pending.

A valid 717-pixel-wide landing observation is saved as
`artifacts/unified-map-shell/landing-narrow-observed.png`. It shows the retained
globe, headline, annotations and Explore action, with the new mode navigation.
Its viewport differs from the desktop baseline, so it is not a matched visual
comparison. The live accessibility tree also confirms that Find Your Fire
reports the backend's HTTP 502 and offers the example-fire fallback.

Matched desktop/mobile captures, visual comparison, live camera/instance-count
checks, refresh/history interaction checks and mobile panel inspection remain
pending. The approximately 90% visual-preservation target has not been measured
or signed off. Automated route, shell-state and backend-client tests pass;
those tests do not substitute for browser verification.

The existing study and fire-detail renderers remain separate, with independently
retained cameras. Closing/clearing a fire reveals the retained study camera;
reopening the same cached fire retains its detail view. The shell adds no map
constructors and does not consolidate these renderers in Phase 1.

Only one documentation fire is available. Four calibrated exports and live
search/processing remain external dependencies and later-phase work.

The isolated development preview runs at `http://127.0.0.1:5177/`.
