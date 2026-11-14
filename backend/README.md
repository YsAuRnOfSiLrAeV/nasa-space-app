# Backend

Pipeline that turns a fire perimeter into the result files the frontend shows:
fire polygon -> satellite layers on a common grid -> model -> `result.json`, `cells.json`, `optical.png`.

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

Once `models/` is in the repository, install it into the same environment:
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

**Pipeline for one fire** (once `pipeline/run.py` is implemented)
```bash
python -m pipeline.run --fire <fire_id or path/to/fire.geojson> --year 2026 --out ../data/fires
```

## Adding a dependency

Add it to `dependencies` in `pyproject.toml`, then run `pip install -e ".[dev]"` again.
Everyone else re-runs the same command after pulling.