# Backend

The pipeline turns a fire perimeter into the result files the frontend draws. One run takes a
fire polygon and a summer, reads the satellite data for that summer onto a common grid, runs the
models and writes `result.json`, `cells.json` and the shared `index.json`.

## How the pipeline works

Every layer is a 2D array on the same 30 m grid, so cell `[row, col]` is the same patch of
ground in every layer.

| Step | Module | What it does |
|---|---|---|
| 1 | `grid.py` | Lays a 30 m grid in the fire's UTM zone over the fire and a 6 km ring around it |
| 2 | `nisar.py` | Finds NISAR GCOV granules for the summer and reads HH and HV at every cell centre |
| 3 | `gee/layers.py` | Sentinel-1 VH and VV, Sentinel-2 NDVI, elevation and slope, and land cover, forest loss and fire history masks from Google Earth Engine |
| 4 | `gee/zones.py` | Marks each cell as burn, neighbour forest (1.5-6 km ring, undisturbed) or excluded |
| 5 | `gee/gedi.py` | Height of the neighbour forest from GEDI lidar, which counts as 100% recovery |
| 6 | `cell_features.py` | Turns the five input maps into one row per cell for the state model, and puts its output back on the grid |
| 7 | `model.py` | The only module that calls the `forestrecovery` library: regional model, input check, state model, fire recovery, forecast |
| 8 | `fire_stats.py` | Fire-level numbers: forecast inputs (median of each factor over the burn) and the totals in `result.json` |
| 9 | `export.py` | Merges cells into display cells (90 m or larger) and writes the result files |
| | `run.py` | Runs the steps above for one fire |
| | `batch.py` | Runs every demo fire of the model library, skipping fires already done |

Steps 2, 3 and 4-5 do not depend on each other and run in parallel. GEDI shots are downloaded once:
the ring around the fire gives the neighbour forest height, the shots inside the burn give the lidar
comparison. Those shots are filtered as the model's training labels were (slope under 10 degrees, at
least 100 m inside the perimeter, no later fire or logging), so the lidar number is the same measure
the model was validated against. The Sentinel-2 colour picture (`optical.png`) is fetched on the display grid. The input values match the
ones the model was trained on: same products, same date windows, same processing.

`contract.py` holds the names of the input layers and the zone codes that all modules share.
The result format is described in the team deliverables (tab 1).

## Requirements

- Python 3.10 or newer (3.11 or 3.12 recommended)
- Git

## Setup

Run these once, from the repository root.

**Windows (cmd)**
```cmd
cd backend
python -m venv .venv
.venv\Scripts\activate.bat
pip install -e ".[dev]"
```

**Windows (PowerShell)**
```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
```
If PowerShell blocks the script, run once: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`

**macOS / Linux**
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

You should see `(.venv)` at the start of the prompt. To leave the environment, run `deactivate`.

### Model library

The models live in `models/` (the `forestrecovery` library). Install it into the same environment:
```bash
pip install -e ../models
```

### Editor

Point your editor to the interpreter in `backend/.venv`, otherwise imports show as missing.
- **VS Code:** `Ctrl+Shift+P` -> *Python: Select Interpreter* -> `backend/.venv`
- **PyCharm:** Settings -> Project -> Python Interpreter -> Add Interpreter -> Existing -> `backend/.venv`

## Credentials

Needed only to run the pipeline on real data, not for the tests.

- **NASA Earthdata** (NISAR): create an account at https://urs.earthdata.nasa.gov and set
  `EARTHDATA_USERNAME` and `EARTHDATA_PASSWORD` in `backend/.env`.
- **Google Earth Engine** (Sentinel-1, Sentinel-2, WorldCover, Hansen, MODIS, GEDI): get access to the
  team Cloud project, then run once:
  ```bash
  earthengine authenticate
  ```
  and set `GEE_PROJECT` in `backend/.env`.

`.env` is in `.gitignore`. Never commit credentials.

## Run

**Tests**
```bash
python -m pytest
```

**Pipeline for one fire**
```bash
python -m pipeline.run --polygon path/to/fire.geojson --summer 2026 --out ../data/fires
```

**All demo fires of the model library** (main page fires first, already computed fires are skipped)
```bash
python -m pipeline.batch --summer 2026 --out ../data/demo
python -m pipeline.batch --summer 2026 --out ../data/demo --ids bc_2003_490 quebec_1995_1218
```

## Adding a dependency

Add it to `dependencies` in `pyproject.toml`, then run `pip install -e ".[dev]"` again.
Everyone else re-runs the same command after pulling.

## API

REST API for the "Find your fire" page: search the fire catalog under a drawn polygon, then run the pipeline for the chosen fire.

```bash
pip install -e ".[dev,api]"
uvicorn api.main:app --reload
```

Interactive docs: http://127.0.0.1:8000/docs. The frontend dev server proxies `/api` to it.

| Request | Answer |
| --- | --- |
| `GET /health` | `{"status": "ok"}` |
| `POST /fires/search` | fires under a polygon. Body: `polygon` (GeoJSON), optional `year_from`, `year_to`, `min_area_ha`, `limit` (100, at most 500) |
| `GET /fires/{fire_id}` | one fire with its perimeter |
| `GET /summers?fire_id=` | summers the fire can be analysed for |
| `POST /runs` | start the analysis. Body: `fire_id`, `summer` |
| `GET /runs/{run_id}` | `pending` with step and progress, `complete` with the address of `result.json`, or `failed` with a code |
| `GET /results/{fire_id}/{file}` | `result.json`, `cells.json`, `optical.png` |

A search answers with `status`:

- `outside_regions`: the polygon touches no model region, nothing can be analysed there
- `no_fires`: it is inside a region, but the catalog has no fire there with these filters
- `ok`: the fires, largest first, each with `overlap`, the share of the fire inside the polygon

`regions` gives the share of the polygon in tier A (verified) and tier B (extrapolated) regions. Errors are `{"code": "...", "message": "..."}`.

A run takes minutes, so it works in the background, one at a time, and the client polls. A fire computed before is answered from its files. Running needs the pipeline credentials above and `pip install -e ../models`; without them a run fails with `NOT_CONFIGURED`, while search still works.

| Variable | Default | What |
| --- | --- | --- |
| `FIRE_CATALOG_DIR` | `../data/gfa` | packed fire files |
| `FIRE_REGIONS_DIR` | `../data/regions` | model regions, GeoJSON with a `tier` property |
| `FIRE_RESULTS_DIR` | `../data/fires` | where runs write their results |
| `API_ALLOWED_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | sites allowed to call the API from a browser |
| `API_PUBLIC_URL` | address of the request | address the browser reaches the API at, when behind a proxy |

## Fire catalog

The catalog is the Global Fire Atlas: about 12.6 million fire perimeters, 2002-2026, already limited to the model regions. It is 400 MB, so it is not in Git: **put the `gfa_<year>.parquet` files into `data/gfa/` yourself** (ask Misha for them). The API builds `index.npz` next to them on first start (under a minute) and reuses it afterwards.

The files are packed (`catalog/packed.py`): every perimeter vertex sits on the MODIS 463 m pixel grid, so vertices are stored as whole pixel steps. That is lossless and about four times smaller than the atlas zip.

To rebuild the files from the atlas download (`SHP_perimeters.zip`, 3 GB; about 20 minutes):

```bash
pip install -e ".[catalog]"
python -m catalog.pack path/to/SHP_perimeters.zip ../data/gfa --regions ../data/regions/ecoregions_covered.geojson ../data/regions/ecoregions_extended.geojson
```

Only fires whose perimeter overlaps a model region are kept, each with its `tier`.
