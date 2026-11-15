"""REST API for the "Find your fire" page.

    uvicorn api.main:app --reload

    GET  /health                       is the service up
    POST /fires/search                 fires under a drawn polygon, with filters
    GET  /fires/{fire_id}              one fire with its perimeter
    GET  /summers?fire_id=             summers the fire can be analysed for
    POST /runs                         start the recovery analysis of a fire
    GET  /runs/{run_id}                its state; when complete, the address of result.json
    GET  /results/{fire_id}/{file}     result.json, cells.json, optical.png

A search answers with one of three states:
    outside_regions   the polygon touches no model region, so no analysis is possible there
    no_fires          it is inside the regions, but the catalog has no fire there (with these filters)
    ok                the fires, largest first

Errors are JSON ``{"code": "...", "message": "..."}``.
The fire catalog and the regions are files the service reads from ``data/`` (see backend/README.md).
"""

from __future__ import annotations

import re
import threading
from functools import lru_cache
from pathlib import Path
from typing import Callable

import shapely
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field
from pyproj import Geod
from shapely.geometry import shape
from shapely.geometry.base import BaseGeometry

from catalog.fires import CatalogMissing, Filters, Fire, FireCatalog
from catalog.regions import Regions

from .runs import Run, Runs
from .settings import SUMMERS, Settings

MAX_SEARCH_AREA_KM2 = 500_000
RESULT_FILES = {"result.json", "cells.json", "optical.png"}
FIRE_ID = re.compile(r"^[A-Za-z0-9_]+$")
WGS84 = Geod(ellps="WGS84")


class ApiError(Exception):
    def __init__(self, status: int, code: str, message: str):
        self.status, self.code, self.message = status, code, message


class SearchRequest(BaseModel):
    polygon: dict = Field(description="GeoJSON Polygon or MultiPolygon, lon/lat")
    year_from: int | None = None
    year_to: int | None = None
    min_area_ha: float | None = Field(default=None, ge=0)
    limit: int = Field(default=100, ge=1, le=500)


class RunRequest(BaseModel):
    fire_id: str
    summer: int


def create_app(settings: Settings | None = None, compute: Callable | None = None, preload: bool = False) -> FastAPI:
    """The API. ``compute`` replaces the pipeline in tests."""
    settings = settings or Settings.from_env()
    app = FastAPI(title="Forest Recovery API")
    app.add_middleware(CORSMiddleware, allow_origins=list(settings.allowed_origins), allow_methods=["GET", "POST"], allow_headers=["*"])
    runs = Runs(settings.results_dir, compute or run_pipeline)

    @lru_cache(maxsize=1)
    def catalog() -> FireCatalog:
        try:
            return FireCatalog(settings.catalog_dir)
        except CatalogMissing as error:
            raise ApiError(503, "CATALOG_MISSING", f"{error}. See 'Fire catalog' in backend/README.md.") from error

    @lru_cache(maxsize=1)
    def regions() -> Regions:
        files = sorted(settings.regions_dir.glob("*.geojson"))
        if not files:
            raise ApiError(503, "REGIONS_MISSING", f"no region files (*.geojson) in {settings.regions_dir}")
        return Regions.load(files)

    def known_fire(fire_id: str) -> Fire:
        fire = catalog().get(fire_id)
        if fire is None:
            raise ApiError(404, "FIRE_NOT_FOUND", f"no fire {fire_id} in the catalog")
        return fire

    @app.exception_handler(ApiError)
    def api_error(_request: Request, error: ApiError) -> JSONResponse:
        return JSONResponse({"code": error.code, "message": error.message}, status_code=error.status)

    @app.get("/health")
    def health() -> dict:
        return {"status": "ok"}

    @app.post("/fires/search")
    def search(body: SearchRequest) -> dict:
        area = _search_area(body.polygon)
        shares = regions().tier_shares(area)
        if not shares:
            return {"status": "outside_regions", "regions": {}, "total": 0, "truncated": False, "fires": []}
        found = catalog().search(area, Filters(body.year_from, body.year_to, body.min_area_ha), body.limit)
        return {
            "status": "ok" if found.total else "no_fires",
            "regions": shares,
            "total": found.total,
            "truncated": found.truncated,
            "fires": [_fire_json(fire, area) for fire in found.fires],
        }

    @app.get("/fires/{fire_id}")
    def fire(fire_id: str) -> dict:
        return _fire_json(known_fire(fire_id))

    @app.get("/summers")
    def summers(fire_id: str) -> dict:
        return {"summers": _summers(known_fire(fire_id))}

    @app.post("/runs")
    def start_run(body: RunRequest, request: Request) -> dict:
        fire = known_fire(body.fire_id)
        if body.summer not in _summers(fire):
            raise ApiError(422, "SUMMER_UNAVAILABLE", f"no satellite data to analyse this fire for summer {body.summer}")
        return _run_json(runs.start(fire, body.summer), request)

    @app.get("/runs/{run_id}")
    def run_state(run_id: str, request: Request) -> dict:
        run = runs.get(run_id)
        if run is None:
            raise ApiError(404, "RUN_NOT_FOUND", f"no run {run_id}")
        return _run_json(run, request)

    @app.get("/results/{fire_id}/{name}")
    def result_file(fire_id: str, name: str) -> FileResponse:
        path = settings.results_dir / fire_id / name
        if not FIRE_ID.match(fire_id) or name not in RESULT_FILES or not path.is_file():
            raise ApiError(404, "RESULT_NOT_FOUND", f"no {name} for fire {fire_id}")
        return FileResponse(path)

    def _run_json(run: Run, request: Request) -> dict:
        if run.status == "complete":
            base = (settings.public_url or str(request.base_url)).rstrip("/")
            return {"status": "complete", "id": run.id, "result": f"{base}/results/{run.fire_id}/result.json"}
        if run.status == "failed":
            return {"status": "failed", "id": run.id, "code": run.code, "message": run.message}
        return {"status": "pending", "id": run.id, "step": run.step, "progress": run.progress}

    if preload:
        # Reading the catalog index and the regions takes seconds: do it before the first search needs them.
        threading.Thread(target=lambda: (regions(), catalog()), daemon=True).start()
    return app


def run_pipeline(fire: Fire, summer: int, out_dir: Path, on_step: Callable[[str], None]) -> None:
    """Run the recovery pipeline for a catalog fire. Imported here: the search works without the model library."""
    from pipeline import run as pipeline

    lon, lat = fire.center
    name = f"{fire.year} fire at {abs(lat):.2f}°{'N' if lat >= 0 else 'S'}, {abs(lon):.2f}°{'E' if lon >= 0 else 'W'}"
    pipeline.run(pipeline.Fire(id=fire.id, name={"en": name}, year=fire.year, perimeter=fire.perimeter, area_ha=fire.area_ha), summer, out_dir, on_step)


def _search_area(polygon: dict) -> BaseGeometry:
    try:
        area = shape(polygon)
    except Exception as error:
        raise ApiError(422, "INVALID_POLYGON", "polygon is not a GeoJSON geometry") from error
    if area.geom_type not in ("Polygon", "MultiPolygon") or area.is_empty or not area.is_valid or area.area == 0:
        raise ApiError(422, "INVALID_POLYGON", "draw a simple polygon with a non-zero area and no self-crossings")
    km2 = abs(WGS84.geometry_area_perimeter(area)[0]) / 1e6
    if km2 > MAX_SEARCH_AREA_KM2:
        raise ApiError(422, "AREA_TOO_LARGE", f"the polygon covers {km2:,.0f} km²; draw one under {MAX_SEARCH_AREA_KM2:,} km²")
    return area


def _summers(fire: Fire) -> list[int]:
    """Summers with satellite data that come after the fire."""
    return [summer for summer in SUMMERS if summer > fire.year]


def _fire_json(fire: Fire, area: BaseGeometry | None = None) -> dict:
    out = {
        "id": fire.id,
        "year": fire.year,
        "start_date": fire.start_date,
        "end_date": fire.end_date,
        "area_ha": fire.area_ha,
        "center": list(fire.center),
        "tier": fire.tier,
        "perimeter": fire.perimeter,
    }
    if area is not None and fire.geometry.area > 0:
        # Share of the fire that lies inside the drawn polygon.
        out["overlap"] = round(shapely.intersection(shapely.make_valid(fire.geometry), area).area / fire.geometry.area, 4)
    return out


app = create_app(preload=True)
