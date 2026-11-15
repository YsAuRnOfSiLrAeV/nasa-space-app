# Find Your Fire integration

Search reuses the persistent map and shared fire investigation. No production catalog or applicability boundaries are bundled. In development, enable “Development-only mock services” to search the existing labelled demo entries and simulate success or failure. Simulation never generates scientific results. Production builds omit this switch.

## Static files (provisional)

Publish `public/data/catalog/index.json` with `{ "countries": [{ "code": "CA", "name": "Canada", "file": "ca.json" }] }`. The country file is an array of records with `id`, `name`, `year`, `center: [longitude, latitude]`, `perimeter: Polygon | MultiPolygon | null`, and `resultId: string | null`. Supply actual coordinates. `resultId` identifies a fire in the existing demo index; catalog-only records use null. Relative paths are validated. Country and fire selection are preserved in hash URLs.

Optional `public/data/catalog/zones.json` is a GeoJSON FeatureCollection of Polygon/MultiPolygon features. Each feature needs provider-approved properties `{ "label": "provider label", "supported": true }`. This is an explicit provisional adapter, not a mapping from scientific confidence codes. No meaning is assigned to codes 0/1/2. Only explicitly supported polygons count towards coverage; overlapping areas are unioned before intersection. Missing zones leave coverage unknown and disable real analysis requests. Zero, nonzero partial, and complete spatial overlap are reported without a scientific cutoff.

## API (provisional)

`VITE_API_URL` configures the API base; development otherwise uses the existing `/api` proxy. Wire shapes are isolated in `src/services/search/contracts.ts` and `AnalysisClient.ts`:

- `GET /summers?fire_id=...`: `{ "summers": [2026] }`.
- `POST /runs`: `{ "fire_id": "supplied-id", "summer": 2026 }`.
- POST response and `GET /runs/{id}` response: pending `{ "status": "pending", "id": "run-id", "step": "arbitrary backend text", "progress": 0.5 }`; complete `{ "status": "complete", "result": "https://host/fire/result.json" }`; failed `{ "status": "failed", "code": "PROVIDER_CODE", "message": "optional explanation" }`.

The POST doubles as the cache lookup and can immediately return complete. No progress vocabulary is assumed. Requests time out after 20 seconds; polling stops after ten minutes, on cancellation, selection changes, or leaving Search. Result and cell responses use existing Zod contracts and grid-length validation. The selected fire id must match the result id. Result assets resolve relative to the result URL. Cross-origin servers must allow browser access.

## Verification

The drawn boundary selects catalog fires by positive perimeter overlap; the list reports the percentage of each fire inside it. Fires with no usable perimeter cannot be matched spatially. Drawing does not change the analysis area: requests always analyze the selected catalog fire using its id and summer. The selected fire's own perimeter is checked against applicability zones before real requests are enabled. Requests are disabled during drawing, and precomputed results open in the shared Examples route using the result id, which may differ from the catalog id. Browser Back returns to the Search selection.

Geometry tests use explicit synthetic rectangles and holes, including overlapping coverage zones. Tests also cover request encoding, response rejection, and aborted delays. Desktop/mobile browser verification requires an available browser automation host; it was unavailable during implementation. Do not treat source checks as visual verification.
