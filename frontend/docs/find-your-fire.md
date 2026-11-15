# Find Your Fire — real exported catalog

Phase 8 connects the existing search, drawing and shared investigation workflow to all 80 supplied fires. It preserves the persistent map, route handling, polygon tool, result loader and development-only mock processing.

## Data and discovery

- The current country selector and identifier/year/region search use the same validated bundle index as Examples. All countries is the default. Supplied Canadian province codes are grouped under Canada; other supplied region codes identify their countries.
- Locations and perimeters come from the source metadata and the lightweight `bundle-v2/perimeters.geojson` collection. No point buffers, approximate fire boundaries or new fire records are generated.
- 37 fires have spatial datasets; 43 have perimeter/summary exports. Cards distinguish these capabilities. Detailed resources load only when a known fire is selected.
- Perimeter interiors and outlines can select known fires. Existing exports open through the shared Examples investigation route; Search selection and country remain shareable in the URL. Browser Back can return to Search.

## Draw and intersect

The existing vertex drawing, keyboard Add map centre, Finish, Cancel, Escape and Clear interactions remain. Invalid/self-crossing/zero-area boundaries are rejected. Finishing a polygon filters catalog fires by positive geographic intersection, including holes and multipolygons. Boundary contact alone is not an intersection with positive area.

The list reports the fraction of each original fire perimeter inside the drawing. An existing export describes its original fire, not a new prediction clipped to the drawing. Result opening is withheld for an unmatched current fire while a drawing is active. Missing or mismatched perimeter geometry remains unknown, with an explanation; coordinates are never substituted for a polygon.

No matching export under the current boundary/country/query/year filters produces an explicit unavailable-data message. Geographic coverage and dataset availability are separate: an area inside a model region can still have no exported dataset.

## Geographic applicability

`confidence_zones.geojson` is copied unchanged from the supplied frontend_katya export. Its meanings are documented by the supplied `BUNDLE_FORMAT.md`:

| Source layer/status                      | UI meaning                                                              |
| ---------------------------------------- | ----------------------------------------------------------------------- |
| `model1_region`, tier 1 / `verified`     | Model-1 verified geographic overlap                                     |
| `model1_region`, tier 2 / `extrapolated` | Extrapolated overlap, not directly validated                            |
| `model2_growth`, `verified`              | Geographic area where the supplied growth forecast was validated        |
| `model2_scenario`, `verified`            | Geographic scenario coverage only; no computation capability is implied |

Coverage is reported for the finished drawing, or for the selected fire perimeter when no drawing is present. Model-1 extrapolated-only coverage excludes verified overlap, so overlapping zones are not double counted. Outside model-1 regions means no applicability claim, not a numerical confidence score. Missing zone layers remain unknown; absent, malformed or failed zone files never become 0% or 100% support.

Provider boundaries are approximate. Percentages describe geometric overlap, not calibrated confidence, model accuracy, export availability or backend authorization. Pipeline confidence codes 0/1/2 and burn/reference masks are not reinterpreted. The shared Confidence zones controls now display verified/extrapolated regions and separate model classifications; see [confidence-methodology.md](confidence-methodology.md).

Intersections prune distant original polygons, clip locally, then union overlaps. This avoids unioning continent-scale geometry on every selection while preserving original rings, holes and exact intersection semantics.

## Processing capability

The local backend exposes `/health` only. Real summer lookup and new analysis remain disabled. Production Search does not call `/summers`, `/runs` or polling endpoints. It opens existing exports only.

Development-only mocks remain explicitly labeled simulations and never create scientific results. The provisional API client and wire contracts remain test preparation, not a production promise.

## Verification

Regression coverage includes all 80 catalog associations and coordinates; country/query filtering; real full/partial/no perimeter intersections; missing/mismatched geometry; source-data loading and shared result routing; verified/extrapolated/outside coverage without double counting; separate growth/scenario coverage; missing/malformed zones; disabled real processing; polygon picking and drawing cleanup. Source-zone copying is checked against the original file.

Full desktop/mobile browser acceptance remains NOT VERIFIED while the browser automation host is unavailable. Manual acceptance should cover search → perimeter selection → shared result, drawing and cancellation, real matches/no matches, known perimeter-only exports, model-specific coverage, missing zones, switching to Examples, URL reload and Back/Forward. Automated geometry/data checks do not establish visual acceptance.

No backend changes, invented scientific values, new dependencies or automatic commits are introduced.

## Global fire atlas (backend)

When an API is configured (`VITE_API_URL`, or the dev proxy at `/api`), Find Your Fire also searches the backend fire atlas: about 12 million Global Fire Atlas perimeters, 2002–2026, already limited to the model regions. Without an API the section is not rendered and everything above works as before.

Finishing a polygon sends it to `POST /fires/search` with the optional year and minimum-area filters. The answer is one of three outcomes, each with its own message:

| `status`          | Meaning                                                                       |
| ----------------- | ----------------------------------------------------------------------------- |
| `outside_regions` | The polygon touches no model region; nothing can be analysed there            |
| `no_fires`        | It is inside a region, but the atlas has no fire there with these filters     |
| `ok`              | Fires, largest first, each with the share of its perimeter inside the polygon |

The summary also reports how much of the polygon lies in a verified (tier A) and an extrapolated (tier B) region. Atlas perimeters are drawn with the rest of the search geometry and can be clicked.

Choosing a fire puts its id (`gfa_<number>`) in the URL like any other selection, so the link can be shared and reloaded; a fire opened this way is fetched with `GET /fires/{id}`. `GET /summers` tells which summers it can be analysed for; a fire as recent as the latest summer has none. **Analyse forest recovery** calls `POST /runs`, polls `GET /runs/{id}` while showing the pipeline step and progress, and opens the finished result in the shared investigation view. A fire computed before is returned at once. A failed run shows the backend's code and message, for example `NOT_CONFIGURED` when the server has no satellite credentials.

The answers are validated by `AtlasSearchSchema`, `AtlasFireSchema` and `RunSchema` in `src/services/search/contracts.ts`. Wording of the outcomes lives in `src/services/search/atlas.ts` and is covered by `atlas.test.ts`. The exported 80-fire catalog is unchanged: a new analysis is offered for atlas fires only.
