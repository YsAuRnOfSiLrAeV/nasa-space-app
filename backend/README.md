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
| 3 | `gee/layers.py` | Sentinel-1 VH and VV, Sentinel-2 NDVI, and land cover, forest loss and fire history masks from Google Earth Engine |
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
comparison. The Sentinel-2 colour picture (`optical.png`) is fetched on the display grid. The input values match the
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