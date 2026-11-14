# Unified Map Shell: Phase 1

## Preserved composition

The root remains the existing scientific-cartography landing. Preserve its
asymmetric layout, headline, globe, animation, annotations, imagery and Explore
action. No separate landing route, new dependencies, new globe or scientific
calculations are introduced. Research content and Recovery routes remain intact.

## Implemented shell

1. Hash query state separates `intro`, `explore` and `fire` presentation from
   `examples` and `search` modes. A supplied fire ID opens its result directly.
   Legacy fire, analysis and Recovery addresses remain supported.
2. Shared navigation places the brand on the left, modes in the center and
   How We Researched on the right. Mobile places modes on a second row.
3. A collapsible investigation panel appears only beyond intro. It reads the
   existing export index and reports loading, empty and error states. Search
   uses the existing backend health client and honestly states processing is
   unavailable, even when the health endpoint responds.
4. The existing FireRecovery is embedded in the Map workspace with its own
   existing renderer. Its most recent result stays mounted when selection is
   cleared. No additional map constructor or replacement visualization is added.
   Existing study tools remain accessible under a disclosure in the panel.
5. URL changes and panel collapse do not fit/reset the camera. Explicit Explore,
   Back to Globe, fire selection and existing study-tool actions may move it.
   Mode changes clear active fire selection, retaining cached results and each
   existing renderer's camera. Camera coordinates are not serialized to the URL.

## Validation and limits

Run typecheck, lint, all unit tests, all existing data validators and production
build. Compare desktop/mobile landing captures and inspect map persistence,
direct links, history, selection, collapse, unavailable backend and missing data
in a real browser before final visual sign-off.

The initial desktop baseline and a later narrow-window observation are saved in
`artifacts/unified-map-shell/`. The full combined checks and production build
pass. Browser checks were resumed after the earlier Escape interruption, but
the browser host is unavailable and native automation reports repeated input
and window-bound conflicts. Matched desktop/mobile comparisons and interactive
camera/history checks remain pending, not passed. See the implementation report.

The existing study map and fire-detail map retain separate cameras. This phase
does not consolidate them into a single renderer. Clearing a fire returns to the
retained study camera; reopening the same cached fire restores its detail view.

Four calibrated exports, catalog search, polygon drawing and live processing
remain later work. Only one documentation example is currently published.
