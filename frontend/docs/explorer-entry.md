# Landing and Explorer navigation

- Landing remains `#/`.
- Examples opens `#/explore?mode=examples`, with no fire selected and all 80 supplied fires searchable, grouped by supplied region and year. Entries distinguish spatial data from perimeter/summary-only exports, and mark available timelines and forecasts.
- Find Your Fire from Landing opens `#/explore?mode=find-your-fire&draw=1`. The Examples sidebar's Draw Your Polygon action uses the same route and drawing controls.
- Selected examples use `#/explore?mode=examples&fire=FIRE_ID`. The selected-fire layout shows settings on the right, recovery controls below and an Other fires link at the top left. That link returns to the searchable Examples list without a selection.
- Legacy `#/?view=...&mode=search` and direct fire links remain readable. Ordinary hash links preserve Back/Forward behavior without reloading the document or replacing the MapLibre instance.

Polygon drafts live in the persistent Explorer composition rather than the conditional search panel. Switching modes or returning to Landing preserves the in-memory vertices and completed selection. Returning via the drawing action resumes the draft. Cancel/Escape discards unfinished vertices while retaining the previous completed polygon. Clear Selection removes both. A document reload does not persist polygon geometry; `draw=1` starts the drawing workflow again.

Draw Polygon, Finish Drawing, Clear Selection and Analyze Area are shown above catalog browsing. Finish requires at least three vertices and uses the existing geometry validation. Analyze Area remains disabled with a submission-unavailable explanation. Existing overlapping exports can be opened; no new prediction or scientific data is generated.

## Verification

Automated checks passed: formatting, TypeScript, ESLint, 590 tests across 64 files, data validation, and production build.

Browser visual acceptance was verified at desktop and mobile widths. Both Landing actions opened the correct mode; map and sidebar fire selection stayed synchronized; selected-fire layout, Other fires, Back/Forward, direct reload, and invalid IDs behaved as expected. Unfinished polygon vertices survived mode changes, and switching modes preserved the same MapLibre instance. Mobile layout had no horizontal overflow.
