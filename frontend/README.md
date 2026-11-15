# frontend

Design and maintenance: [Frontend design guide](docs/design-guide.md).

Власниця: Катя. React + TypeScript + Vite, MapLibre GL, Tailwind. Хостинг Vercel.

Сторінки: головна з глобусом (`#/`), пожежа (`#/fire/<fire_id>`), "Як ми дослідили" (`#/research`),
відновлення (`#/recovery/...`), "Своя пожежа" (`#/analyze`).

## Запуск

```bash
cd frontend
npm ci
npm run dev        # http://localhost:5173
npm run check      # формат, типи, лінт, тести, перевірка даних
npm run build      # dist/
```

Node 20.19+. Збирати з терміналу, де шлях починається з `C:\` (великою літерою): з `c:\` Vite
на Windows не додає шрифти в збірку, а vitest падає.

## Зв'язок з бекендом

### Демо-пожежі: `data/demo/` (формат DELIVERABLES, вкладка 1)

Пайплайн (`backend/pipeline/run.py --out ../data/demo/<fire_id>`) пише результати в `data/demo/`
у корені репозиторію. Фронт сам нічого туди не пише, лише читає:

- **Є `data/demo/index.json`**: dev-сервер віддає цю папку за адресою `/data/demo/`, а
  `npm run build` копіює її в `dist/data/demo/`. Позначка "приклад з документації" на сторінці
  пожежі зникає.
- **Немає**: фронт показує приклад з документації (`frontend/public/data/demo/`) і чесно
  підписує його як приклад.

Перевірити, що результат пайплайна відкривається у фронті:

```bash
npm run data:demo                                   # папка, яку побачить застосунок
FIRE_DEMO_DIR=../шлях/до/виходу npm run data:demo   # будь-яка інша папка з index.json
```

Перевірка вантажить кожну пожежу тим самим кодом, що й застосунок (`StudyDataApi.loadFire`):
схеми `index.json`, `result.json`, `cells.json` (`src/data/fireSchema.ts`), збіг `id`/`year`/`summer`,
довжина кожного масиву `cells.json` = `columns × rows`, наявність `optical.png`. Входить у
`npm run check`.

Коди попереджень (`warnings` у `result.json`) фронт перекладає сам: `AGE_OUT_OF_RANGE`,
`PARTIAL_CONFIDENCE`, `OUT_OF_DOMAIN`. Новий код показується як є з позначкою, що його значення
треба уточнити. Тексти: `src/compositions/earth-intelligence/FireInvestigation.tsx`.

### Examples on the Map (four fires)

Examples mode lists every fire in `index.json` in the right panel and as markers on the landing
globe and on the map. Selecting a fire (panel, marker or a direct link
`#/?view=fire&mode=examples&fire=<id>`) updates the URL; the camera then makes one flight to the
grid. The fire is drawn on the shared map, never on a second map instance.

- **Grid:** one image with one pixel per cell, stretched over `corners_lonlat` (TL, TR, BR, BL).
  Cell lookup for the tooltip inverts the same mapping (`src/domain/fire/fireGrid.ts`).
- **Layers:** forest stage (`model.stage`) and relative forest score (`model.p_forest_gt5`,
  shown as Low / Medium / High; never as a percentage, because the calibration study found
  it is not a calibrated probability. Provisional bands: `SCORE_BANDS` in
  `src/data/calibrationEvidence.ts`). Both are categorical; the tooltip
  shows categories only, never per-cell numbers. Cells with `map.confidence = 0` are grey
  ("outside the model's geographic domain"), which is separate from the model's score.
  Missing cells stay empty and are never interpolated.
- **Overlays**, only where the export supplies them: fire perimeter, neighbouring-forest zone
  (`map.zone = 0`), GEDI footprints (`lidar_points`, described by stage band), and
  `optical.png` (optional; preloaded, and a missing file is reported instead of drawn).
- The grid shows the observation summer only. Forecast years do not recolour it.
- **Without a mouse:** the panel's "Cells without the map" section has a captioned table of cell
  counts per category and area, and a row/column inspector (spinbuttons, previous/next cell with
  data, "Show on map"). The inspected cell is outlined on the map; clicking a cell selects it there.
- **Independent of the Ontario study:** the map mounts even when `manifest.json` or
  `points.geojson` fail to load (empty points, Canada-wide extent). All four fires still open;
  the Ontario points appear on the same map if a later retry succeeds.

**Results and forecast** (`src/components/fire/FireResults.tsx`, independent of how the fire was
chosen). The panel separates the observation (summer state, which the grid shows) from the
prediction (fire-level forecast):

- **State in summer N:** whole-fire recovery and the export's `error_vs_lidar_pct` (never a
  hardcoded error), area recovered to 80%, forest-stage shares as a three-segment bar in the
  map's stage colours, neighbouring forest height with its named source, and the optical /
  model / lidar comparison only when at least two of those values are supplied.
- **Missing versus zero:** only `null`/absent is "Not available"; `0` is shown as `0%`
  (`fireSummary.ts`, tested in `fireResults.test.tsx`). Missing items are listed by name.
- **Forecast:** `saturating_exp` is drawn as r(age) = 1 − exp(−age / τ), and only when that curve
  reproduces the supplied `years_to_80pct` (τ·ln 5, ±0.5 years) and `year_80pct` (±1 year);
  otherwise the panel says why it is not drawn (`growthForecast.ts`). Ages outside
  `reliable_age` are dashed and labelled extrapolation. The export has no forecast interval, so
  none is drawn. The summer's model estimate is plotted as a separate point.
- **Year slider** at the bottom of the map, only for a valid forecast. It changes the forecast
  readout and chart marker; the grid, camera, URL and inspected cell stay unchanged. Each fire
  selection starts at its observation summer.
- **Details** (collapsed): metadata, method, warnings and sources.

**Basemap without tiles.** Natural Earth land (`data/reference/ne_110m_land.geojson`, served by
the app) is drawn in muted colours under the NASA GIBS imagery (`src/components/map/localLand.ts`,
theme tokens `--map-land`, `--map-land-line`). Where GIBS or OpenFreeMap tiles fail, land and
coastlines remain.

**Development fixtures.** Until the team exports arrive, `public/data/demo/` holds the
documentation example (British Columbia 2003) and three development fixtures (Quebec 1995,
Quebec 2010, Ontario 1988) generated by `npm run data:fixtures` (`scripts/build-dev-fixtures.ts`;
`npm run check` verifies they are current). Fixtures carry the `DEVELOPMENT_FIXTURE` warning and
"(dev fixture)" in their names. Their locations are placeholders, their cells are geometric test
patterns, and they contain no measurements, model results, perimeters or GEDI points. The team
folder `../data/demo/` replaces them completely once it has an `index.json`.

### Research page (`#/research`): evidence and calibration

Five chapters, one scientific question each, with one primary figure per chapter:
optical greenness versus structure, the seven model inputs and the pipeline, height accuracy
against GEDI, where the model works (relative score calibration), and the growth forecast.

- **Evidence data:** `src/data/calibrationEvidence.ts`, transcribed from
  `plan_documentation/CALIBRATION_HEIGHT_VS_GEDI.pdf` and `CALIBRATION_STATUS.pdf`. These are
  calibration-study results, labelled as such on the page. They are never written into the
  example-fire exports and may differ from them.
- **Copy:** `src/pages/research/chapters.ts` (questions, text, captions, unresolved notes).
  Layout is in `ChapterFrame.tsx` and `figures/`. To substitute reviewed findings, edit the
  data and copy files only.
- **Provisional items are marked on the page:** the optical-to-recovery rule (NDVI 0.2…0.8 →
  0…100%), the Low / Medium / High score bands (`SCORE_BANDS`, shared with the map layer), and
  the growth-curve equation, which the app infers from exported parameters.
- **Independent of the Ontario study data:** the chapters render without it. The existing
  sample charts (signal panels, GEDI point cloud, height distribution, optical history) are
  collapsible supporting material and show a retry notice if that data fails.
- **Style:** NASA-style editorial type for this page only (Inter, bold tight headings, mono
  uppercase labels, alternating white and black full-width chapters), scoped by `.doc` in
  `research.module.css`. Figure colours: `--evidence-optical|model|gedi` (dark theme and
  `paper.css`).

### API: `backend/api` (FastAPI)

- **Dev:** запусти бекенд (`cd backend && uvicorn api.main:app`, порт 8000). Vite проксює
  `/api/*` на нього (`/api/health` → `http://127.0.0.1:8000/health`), тож CORS не потрібен.
  Інша адреса: `API_PROXY_TARGET` у `frontend/.env.local`.
- **Продакшн:** `VITE_API_URL` = адреса Cloud Run. Бекенд має дозволити домен фронту (CORS,
  `CORSMiddleware`), інакше браузер заблокує запити.
- Зараз API має лише `GET /health`. Сторінка "Своя пожежа" працює локально на mock-відповіді
  (див. нижче). Коли з'явиться ендпоінт розрахунку, він має віддавати ті самі файли, що й
  пайплайн. Клієнт: `src/services/api/`.

### Find Your Fire

`#/analyze` is a legacy address for the map's search mode. Catalog selection,
polygon drawing and processing are not connected yet; the interface reports
backend availability and offers the precomputed examples. The old standalone
upload/mock page and its alternative forecast have been removed. Future results
must use the same `FireData` contract and shared map/result components as Examples.

## Architecture

See [Architecture](docs/architecture.md) for resource loading, cache ownership,
fire-investigation state, domain boundaries and the research chapter structure.

## Vercel

Root Directory: `frontend`. Build command `npm run build`, output `dist`. Опція "Include files
outside the root directory in the Build Step" має бути увімкнена (за замовчуванням так), щоб
збірка бачила `../data/demo/`. Змінні середовища: `VITE_API_URL`, коли бекенд задеплоєно.

### Optical observations inside a fire screen

The shared fire result view includes the Landsat before/after curtain and annual NDVI history.
Associations are explicit in `demo/observations.json`, beside the demo `index.json`:

```json
{
  "schema_version": 1,
  "links": [
    {
      "fire_id": "YOUR_VERIFIED_FIRE_ID",
      "fire_year": 2002,
      "group_id": "2002_205_-376",
      "basis": "Describe how the sampled burned locations were verified to belong to this fire."
    }
  ]
}
```

Publish the associated record as `frontend/public/data/recovery/<group_id>.json`, together
with every image it names. The record uses the existing `RecoveryFileSchema` written by
`npm run data:landsat`. NDVI values describe the sampled burned and reference locations;
they are not a whole-fire average. The observation record's own season, years, quality
information and source attribution remain visible in the reused charts.

For team exports, put `observations.json` in `data/demo/` (or `FIRE_DEMO_DIR`). The Vite
integration serves/copies it with the other demo files. The bundled documentation example
has an empty registry: the existing Ontario 2002 observations do not belong to BC 2003.
No association is inferred from names, nearest locations or a shared fire year.

The loader validates unique fire mappings, safe group identifiers, matching fire years
and overlapping observation/fire-grid extents. Overlap is a defensive check, not proof of
association; the data owner must verify membership and record the basis. A missing registry
or unlinked fire shows a coverage note. A broken declared association shows an error and
retry action. Forecast-slider changes never alter historical optical observations.

`npm run data:demo` also checks mapping IDs, linked observation records and image files.
