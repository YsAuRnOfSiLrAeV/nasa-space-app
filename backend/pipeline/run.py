"""One pipeline run: fire perimeter + summer -> result files.

    python -m pipeline.run --polygon path/to/fire.geojson --summer 2026 --out ../data/fires

``run`` does the steps below. Every map lies on the same fire grid.

    1. grid      make_grid(perimeter), regional model for the fire centre   grid.py, model.py
    2. data      in parallel threads:                                       nisar.py, gee/
                   NISAR HH, HV
                   Sentinel-1 VH, VV
                   NDVI
                   masks -> zones -> GEDI shots -> neighbour forest height
                   elevation and slope
                   scene counts for result.json
                   Sentinel-2 colour picture on the display grid (optional)
    3. state     cell table -> input check -> state model -> maps            cell_features.py, model.py
    4. numbers   distance to edge, covariates, stage shares, coverage,      fire_stats.py
                 optics, GEDI lidar inside the burn (shots filtered as the
                 training labels were)
    5. forecast  fire recovery and growth forecast                          model.py
    6. files     result.json, cells.json, index.json                        export.py

The API calls ``run`` too, and passes ``on_step`` to show the user which step is running.
"""
from __future__ import annotations

import argparse
import json
import logging
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

import numpy as np
from shapely.geometry import mapping, shape

from . import export, fire_stats, model
from .cell_features import build_table
from .contract import NDVI, NISAR_HV
from .gee import client, gedi, layers, zones as zone_maps
from .grid import Grid, make_grid
from .nisar import nisar_layers

log = logging.getLogger(__name__)
STEPS = ("grid", "data", "state", "numbers", "forecast", "files")
MAX_EXCLUDED_SHARE = 0.15  # above this share of the burn without a model value, the average is likely too high


@dataclass(frozen=True)
class Fire:
    """A fire to compute: catalog entry or user perimeter."""
    id: str
    name: dict                 # {"en": "..."}
    year: int                  # year of the fire
    perimeter: dict            # GeoJSON geometry, lon/lat
    area_ha: float
    extra_warnings: list[str] = field(default_factory=list)


def run(fire: Fire, summer: int, out_dir: Path | str, on_step: Callable[[str], None] | None = None) -> Path:
    """Compute one fire for one summer and write its files to <out_dir>/<fire id>/. Returns that folder."""
    step = on_step or (lambda name: None)

    step("grid")
    grid = make_grid(fire.perimeter)
    centre = shape(fire.perimeter).centroid
    place = model.place(centre.x, centre.y)  # fails here, before any download, where no model applies

    step("data")
    factor = export.display_factor(grid)
    data = _fetch_data(fire, grid, summer, export.display_grid(grid, factor))
    zones = data["zones"]

    step("state")
    table = build_table({**data["nisar"].layers, **data["s1"], **data["ndvi"]}, where=np.isfinite(zones))
    input_issues = model.check_inputs(table, place.model)
    for issue in input_issues:
        log.warning("model input: %s", issue)
    state = model.state(table, place.model)
    stage = table.to_grid(state.stage)
    p_forest = table.to_grid(state.p_forest_gt5)
    height = table.to_grid(state.height_m)

    step("numbers")
    inside = fire_stats.fire_mask(fire.perimeter, grid)
    edge_m = fire_stats.distance_to_edge(inside)
    ndvi = data["ndvi"][NDVI]
    masks = data["masks"]
    # Cells the training sampled: lidar shots and forecast covariates both come from them.
    sampled = fire_stats.lidar_shot_mask(
        fire.year,
        slope=data["terrain"][layers.SLOPE],
        edge_m=edge_m,
        ndvi=ndvi,
        worldcover=masks[layers.WORLDCOVER],
        loss_year=masks[layers.LOSS_YEAR],
        last_fire=masks[layers.LAST_FIRE],
    )
    covariates = fire_stats.covariates({fire_stats.DIST_EDGE: edge_m, **data["terrain"]}, zones, where=sampled)
    nisar_coverage = fire_stats.coverage(data["nisar"].layers[NISAR_HV], zones)
    lidar = fire_stats.lidar_in_burn(data["gedi"], zones, grid, data["reference"]["height_m"], usable=sampled)

    step("forecast")
    reference_m = data["reference"]["height_m"]
    recovery = model.fire_recovery(height, zones, reference_m)
    factors = {**covariates, "ref_rh98_med": reference_m, "fire_size_log": fire_stats.fire_size_log(fire.area_ha)}
    growth, forecast_warnings = model.forecast(fire.year, summer, factors, centre.x, centre.y)

    step("files")
    result = {
        "fire": {"id": fire.id, "name": fire.name, "year": fire.year, "area_ha": round(fire.area_ha), "perimeter": fire.perimeter},
        "satellite_images": {
            "summer": summer,
            "nisar": {
                "date": data["nisar"].main_day.isoformat() if data["nisar"].main_day else None,
                "fire_covered": nisar_coverage,
            },
            **data["images"],
        },
        "map_grid": export.map_grid(grid, factor),
        "neighbour_forest": {"height_m": reference_m, "source": data["reference"]["source"]},
        "model_result": {
            "model_version": model.MODEL_VERSION,
            "region": place.model,
            "recovery_today_avg": recovery["recovery_today_avg"],
            "excluded_share": recovery["excluded_share"],
            "stage_share": fire_stats.stage_share(stage, zones),
            "accuracy": model.accuracy(place.model),
        },
        "growth_forecast": growth,
        "comparison": {
            "optics": fire_stats.optics_recovery(ndvi, zones),
            "model": recovery["recovery_today_avg"],
            "lidar": lidar["lidar"],
            "lidar_points_in_fire": lidar["points_in_fire"],
        },
        "lidar_points": lidar["points"],
        "warnings": _warnings(place, input_issues, nisar_coverage, recovery, data["reference"], forecast_warnings, fire),
    }
    cells = export.cells_json(
        {
            ("model", "stage"): stage,
            ("model", "p_forest_gt5"): p_forest,
            ("map", "zone"): zones,
            ("optics", "ndvi"): ndvi,
        },
        factor,
    )
    optical = export.optical_png(data["optical"]) if data["optical"] is not None else None
    folder = export.write_fire(out_dir, result, cells, optical_png=optical)
    export.update_index(out_dir, result)
    return folder


def _fetch_data(fire: Fire, grid: Grid, summer: int, display: Grid) -> dict:
    """All satellite data for the fire. The downloads do not depend on each other and run at once."""
    client.session()  # log in to Earth Engine once, before the threads start

    def zones_and_reference():
        masks = layers.masks(grid, summer)
        z = zone_maps.make_zones(fire.perimeter, grid, masks)
        heights = gedi.shot_heights(fire.perimeter, grid)
        return masks, z, heights, gedi.reference_height(fire.perimeter, grid, z, heights=heights)

    def optical():
        try:
            return layers.optical_rgb(display, summer)
        except Exception as error:  # the picture is optional: the numbers do not depend on it
            log.warning("optical picture skipped: %s", error)
            return None

    with ThreadPoolExecutor(max_workers=7) as pool:
        nisar = pool.submit(nisar_layers, grid, summer)
        s1 = pool.submit(layers.sentinel1, grid, summer)
        ndvi = pool.submit(layers.ndvi, grid, summer)
        zones_ref = pool.submit(zones_and_reference)
        images = pool.submit(layers.satellite_images, grid, summer)
        rgb = pool.submit(optical)
        terrain = pool.submit(layers.terrain, grid)
        masks, z, heights, reference = zones_ref.result()
        return {
            "nisar": nisar.result(),
            "s1": s1.result(),
            "ndvi": ndvi.result(),
            "masks": masks,
            "zones": z,
            "gedi": heights,
            "reference": reference,
            "images": images.result(),
            "optical": rgb.result(),
            "terrain": terrain.result(),
        }


def _warnings(
    place: model.Place,
    input_issues: list[str],
    nisar_coverage: float,
    recovery: dict,
    reference: dict,
    forecast_warnings: list[str],
    fire: Fire,
) -> list[str]:
    """Warning codes for result.json. The texts live in the frontend."""
    codes = list(fire.extra_warnings)
    if place.extrapolated:
        codes.append("REGION_EXTRAPOLATED")
    if input_issues:
        codes.append("MODEL_INPUT_CHECK_FAILED")
    if nisar_coverage < fire_stats.MIN_NISAR_COVERAGE:
        codes.append("LOW_NISAR_COVERAGE")
    if (recovery["excluded_share"] or 0) >= MAX_EXCLUDED_SHARE:
        codes.append("MANY_CELLS_EXCLUDED")
    if reference["source"] != "gedi":
        codes.append("ACCURACY_NOT_VALIDATED_WITHOUT_GEDI")  # validation used fires with GEDI only
    return codes + [code for code in forecast_warnings if code not in codes]


def fire_from_geojson(path: Path | str) -> Fire:
    """Fire from a GeoJSON Feature file. Properties: id, year, optional name (English) and area_ha."""
    feature = json.loads(Path(path).read_text(encoding="utf-8"))
    props = feature.get("properties") or {}
    geometry = feature["geometry"]
    area_ha = props.get("area_ha")
    if area_ha is None:
        grid = make_grid(geometry)
        area_ha = grid.to_grid_crs(shape(geometry)).area / 10_000
    return Fire(
        id=props["id"],
        name={"en": props.get("name") or f"Fire {props['year']}"},
        year=int(props["year"]),
        perimeter=mapping(shape(geometry)),
        area_ha=float(area_ha),
    )


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--polygon", required=True, help="GeoJSON Feature: fire perimeter with id and year in properties")
    p.add_argument("--summer", type=int, required=True, help="summer of the satellite images, e.g. 2026")
    p.add_argument("--out", required=True, help="folder for index.json and the fire folders")
    args = p.parse_args()
    logging.basicConfig(level=logging.WARNING, format="%(message)s")  # warnings only: libraries log every download at INFO
    folder = run(fire_from_geojson(args.polygon), args.summer, args.out, on_step=lambda s: print(f"[{s}]", flush=True))
    print(f"written to {folder}")


if __name__ == "__main__":
    main()
