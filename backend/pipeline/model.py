"""The only place that calls the forestrecovery model library.

    place(lon, lat)                      which regional model applies at the fire, or OutOfDomainError
    check_inputs(table, model)           forestrecovery.input_report on the five inputs
    state(table, model)                  state model per cell: stage, p_forest_gt5, expected height
    fire_recovery(height, zones, ref)    fire-level recovery for model_result in result.json
    forecast(fire_year, summer, ...)     growth forecast for the fire, None where it is not validated

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
RECOVERED = 0.8  # a cell counts as recovered at 80% of the neighbour forest height


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
    """recovery_today_avg and area_recovered_80pct over the burn zone, from the expected height map."""
    burn = height_m[(zones == ZONE_BURN) & np.isfinite(height_m)]
    if not burn.size or not reference_height_m:
        return {"recovery_today_avg": None, "area_recovered_80pct": None}
    recovery = burn / reference_height_m
    return {
        "recovery_today_avg": round(float(recovery.mean()), 3),
        "area_recovered_80pct": round(float((recovery >= RECOVERED).mean()), 3),
    }


def error_vs_lidar_pct(model: str) -> float | None:
    """Typical fire-level error against GEDI lidar, % of the neighbour forest height. None where not validated."""
    acc = fr.accuracy(model)
    return None if acc is None else acc["fire_level"]["error_vs_lidar_pct_median"]


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
