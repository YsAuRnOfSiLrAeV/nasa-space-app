"""The only place that calls the forestrecovery model library.

    place(lon, lat)                      which regional model applies at the fire, or OutOfDomainError
    check_inputs(table, model)           forestrecovery.input_report on the five inputs
    state(table, model)                  state model per cell: stage, p_forest_gt5, expected height
    fire_recovery(height, zones, ref)    fire-level recovery and the share of the burn the model left out
    accuracy(model)                      how far fire-level recovery was from GEDI lidar in validation
    forecast(fire_year, summer, ...)     growth forecast for the fire, None where it is not validated
    demo_fires(ids)                      the library's demo fires with their perimeters, for batch runs

Recovery is height over the neighbour forest height. Per cell it is too noisy to show
(about 3.7 m error), so it is only given as a fire average, which is the number the
library was calibrated on (median error about 12% of the neighbour forest height).
"""
from __future__ import annotations

from dataclasses import dataclass

import forestrecovery as fr
import numpy as np

from .cell_features import CellTable
from .contract import ZONE_BURN

MODEL_VERSION = f"forestrecovery {fr.__version__}"
OutOfDomainError = fr.OutOfDomainError


@dataclass(frozen=True)
class Place:
    model: str             # regional model name, e.g. "continental"
    extrapolated: bool     # the country was not in training, same forest type
    message: str           # library text about reliability at this place


@dataclass(frozen=True)
class StateResult:
    """State model output, one value per table row. NaN where the library marks the input invalid."""
    stage: np.ndarray          # 0 under 5 m, 1 5-10 m, 2 over 10 m
    p_forest_gt5: np.ndarray   # ranking score 0..1, shown as categories, not a calibrated probability
    height_m: np.ndarray       # expected height from the class probabilities, only for fire averages


def place(lon: float, lat: float) -> Place:
    """Regional model for the fire centre. Raises OutOfDomainError where no model is validated."""
    info = fr.region_for(lon, lat)
    if not info["in_domain"]:
        raise OutOfDomainError(info["message"])
    return Place(model=info["model"], extrapolated=bool(info.get("extrapolated")), message=info["message"])


def check_inputs(table: CellTable, model: str) -> list[str]:
    """Problems the library finds in the five inputs (wrong units, values out of range). Empty when all is fine."""
    report = fr.input_report(**_inputs(table), region=model)
    return [] if report["ok"] else list(report["issues"])


def state(table: CellTable, model: str) -> StateResult:
    """Stage, p_forest_gt5 and expected height for every row of the table."""
    pred = fr.predict_arrays(**_inputs(table), region=model)
    valid = pred["valid"]
    return StateResult(
        stage=np.where(valid, pred["stage"], np.nan).astype(np.float32),
        p_forest_gt5=np.where(valid, pred["p_forest_gt5"], np.nan).astype(np.float32),
        height_m=np.where(valid, fr.expected_height(pred), np.nan).astype(np.float32),
    )


def fire_recovery(height_m: np.ndarray, zones: np.ndarray, reference_height_m: float) -> dict:
    """recovery_today_avg and excluded_share over the burn zone, from the expected height map.

    excluded_share is the part of the burn with no model value: no NISAR or optical data, or inputs
    outside the training range (NDVI under 0.2 is the common case: bare, least recovered ground).
    The average only covers the rest, so a large excluded share means it is likely too high.
    """
    burn = zones == ZONE_BURN
    if not burn.any():
        return {"recovery_today_avg": None, "excluded_share": None}
    valid = height_m[burn & np.isfinite(height_m)]
    excluded = round(1 - valid.size / int(burn.sum()), 4)
    if not valid.size or not reference_height_m:
        return {"recovery_today_avg": None, "excluded_share": excluded}
    return {"recovery_today_avg": round(float(valid.mean() / reference_height_m), 3), "excluded_share": excluded}


def accuracy(model: str) -> dict | None:
    """Fire-level validation against GEDI lidar for result.json. None where the model was not validated.

    error_vs_lidar_pct   median error of fire-average recovery, % of the neighbour forest height
    mae_m                mean absolute error of the fire-average height, m
    null_model_mae_m     the same for always predicting the average, m: the model is only somewhat better
    n_fires              fires with at least min_gedi_points GEDI shots in the burn
    """
    acc = fr.accuracy(model)
    if acc is None:
        return None
    fire = acc["fire_level"]
    return {
        "error_vs_lidar_pct": fire["error_vs_lidar_pct_median"],
        "mae_m": fire["mae_m"],
        "null_model_mae_m": fire["null_model_mae_m"],
        "n_fires": fire["n_fires"],
        "min_gedi_points": fire["min_points_per_fire"],
    }


def forecast(fire_year: int, summer: int, factors: dict, lon: float, lat: float) -> tuple[dict | None, list[str]]:
    """growth_forecast section of result.json and the library's warning codes.

    Returns (None, []) where the growth curve is not validated (outside Canada).
    ``factors`` are the per-fire covariates. Missing ones (None) are left out and the library uses averages.
    """
    covariates = {name: value for name, value in factors.items() if value is not None}
    try:
        f = fr.forecast_recovery(fire_year, covariates, horizon=40, now_year=summer, lon=lon, lat=lat)
    except OutOfDomainError:
        return None, []
    now = f["years"].index(summer) if summer in f["years"] else None
    growth = {
        "method": "saturating_exp",
        "tau": f["tau"],
        "years_to_80pct": f["years_to_80pct"],
        "year_80pct": f["year_80pct"],
        "reliable_age": list(f["reliable_age"]),
        "interval_80_now": None if now is None else [f["low"][now], f["high"][now]],
        "series": {"years": f["years"], "recovery": f["recovery"], "low": f["low"], "high": f["high"]},
    }
    return growth, list(f["warnings"])


def _inputs(table: CellTable) -> dict[str, np.ndarray]:
    return {name: table.column(name) for name in table.names}


def demo_fires(ids: list[str] | None = None) -> list[dict]:
    """Demo fires of the library: {"id", "name", "year", "area_ha", "geometry"}, in library order or in the order of ``ids``."""
    listed = {d["id"]: d for d in fr.list_demo_fires()}
    unknown = [i for i in ids or [] if i not in listed]
    if unknown:
        raise KeyError(f"not demo fires of forestrecovery {fr.__version__}: {', '.join(unknown)}")
    fires = []
    for fire_id in ids or list(listed):
        d = listed[fire_id]
        fires.append({
            "id": fire_id,
            "name": d["name_en"],
            "year": int(d["fire_year"]),
            "area_ha": float(d["area_ha"]),
            "geometry": fr.fire_bundle(fire_id)["polygon"]["geometry"],
        })
    return fires

