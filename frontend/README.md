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
треба уточнити. Тексти: `src/pages/fire/FireRecovery.tsx`.

### API: `backend/api` (FastAPI)

- **Dev:** запусти бекенд (`cd backend && uvicorn api.main:app`, порт 8000). Vite проксює
  `/api/*` на нього (`/api/health` → `http://127.0.0.1:8000/health`), тож CORS не потрібен.
  Інша адреса: `API_PROXY_TARGET` у `frontend/.env.local`.
- **Продакшн:** `VITE_API_URL` = адреса Cloud Run. Бекенд має дозволити домен фронту (CORS,
  `CORSMiddleware`), інакше браузер заблокує запити.
- Зараз API має лише `GET /health`. Сторінка "Своя пожежа" працює локально на mock-відповіді
  (див. нижче). Коли з'явиться ендпоінт розрахунку, він має віддавати ті самі файли, що й
  пайплайн. Клієнт: `src/services/api/`.

### Your own fire: mock workflow

Open `#/analyze`. Choose a published demo fire or upload one GeoJSON Polygon/MultiPolygon
(bare geometry, Feature, or a FeatureCollection containing exactly one Feature). Enter the
uploaded fire's name and year. The observation summer is fixed to 2026, with the July–August
model window explained beside the control.

The mock workflow shows progress, supports cancellation and retries, and opens `FireRecovery`,
the same result component used by `#/fire/<id>`. Choosing another fire returns to the retained
form inputs. Catalog mode loads the existing export unchanged; it does not recompute it.

Uploads stay in browser memory and are not sent to the processing API or written to disk.
Files are limited to 1 MB and 1,000 vertices. Coordinates must be WGS84 longitude/latitude;
rings must be closed, have non-zero area and avoid self-crossing. The demo map supports
latitudes between -85 and 85 and does not accept date-line-crossing perimeters.

Uploaded results use an illustrative 20×20 recovery grid clipped to the polygon, including
holes and MultiPolygons. The grid resolution is approximate. These values are for interaction
testing, not scientific analysis: `MOCK_RESULT` marks their provenance. Satellite acquisitions,
NDVI, GEDI, height stages/probabilities, model errors and growth parameters remain missing.
Forecast controls remain unavailable for uploads until real model outputs provide parameters.
Catalog results retain their supplied observations and existing forecast previews.

The UI and result view label mock data explicitly. Processing uses `runMockAnalysis` in
`src/pages/analyze/mockAnalysis.ts`; replacing that boundary with a future API response should
preserve the shared result contract. Tests cover parsing, clipped grids, missing data,
catalog loading, cancellation, late responses and error paths.

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
