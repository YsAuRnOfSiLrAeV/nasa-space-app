"""Per-fire numbers: inputs of the forecast model and the fire totals in result.json.

The forecast model works on the whole fire, not on cells. Besides the fire year
it takes one value per covariate (slope, elevation, soil, burn severity, distance
to the fire edge and so on). The pipeline has most of them as maps on the fire
grid. ``covariates`` reduces each map to one number, the median over the burn
zone. ``distance_to_edge`` and ``fire_size_log`` give the two covariates that do
not come from Earth Engine.

The same kind of reduction gives the fire totals written to result.json:

    stage_share       model_result.stage_share, from the state model's stage map
    coverage          satellite_images.nisar.fire_covered
    optics_recovery   comparison.optics
    lidar_in_burn     comparison.lidar and lidar_points, from the GEDI shots inside the burn

All functions take maps on the fire grid and the zones map (ZONE_BURN,
ZONE_REFERENCE, NaN for excluded cells).
"""
from __future__ import annotations

import math
from typing import Mapping

import numpy as np
import shapely
from pyproj import Transformer
from scipy.ndimage import distance_transform_edt
from shapely.geometry import shape
from shapely.geometry.base import BaseGeometry

from .contract import ZONE_BURN, ZONE_REFERENCE
from .grid import CELL_M, Grid

# Forecast model covariates that come as maps and are reduced to their burn-zone median.
# Names as in the model's training data. Any of them may be missing: the model then uses the Canada mean.
DIST_EDGE = "dist_edge_m"
GRID_COVARIATES = ("dnbr", "nbr_pre", "elev", "slope", "soil_clay", "soil_sand", "soil_org_c", DIST_EDGE)

STAGES = 3                    # model stages: 0 under 5 m, 1 5-10 m, 2 over 10 m
MIN_NISAR_COVERAGE = 0.8      # below this share of the burn zone, the fire result gets a warning
MIN_LIDAR_SHOTS = 10          # fewer GEDI shots in the burn give no lidar recovery (as in model validation)
MAX_LIDAR_POINTS = 300        # points written to result.json for the map, spread over the burn


def fire_mask(polygon: BaseGeometry | dict, grid: Grid) -> np.ndarray:
    """Cells whose centre lies inside the fire perimeter (lon/lat), lakes included."""
    geom = shape(polygon) if isinstance(polygon, dict) else polygon
    return shapely.contains_xy(grid.to_grid_crs(geom), *grid.cell_centers())


def distance_to_edge(inside: np.ndarray) -> np.ndarray:
    """Metres from each cell inside the fire to the nearest cell outside it, NaN outside.

    Distance to the perimeter, as in training, so lakes inside the fire do not count as an edge.
    """
    distance = distance_transform_edt(inside, sampling=CELL_M).astype(np.float32)
    distance[~inside] = np.nan
    return distance


def fire_size_log(area_ha: float) -> float:
    return round(math.log10(area_ha), 4)


def burn_median(layer: np.ndarray, zones: np.ndarray) -> float | None:
    values = layer[(zones == ZONE_BURN) & np.isfinite(layer)]
    return round(float(np.median(values)), 4) if values.size else None


def covariates(layers: Mapping[str, np.ndarray], zones: np.ndarray) -> dict[str, float | None]:
    """Median over the burn zone of every grid covariate. None when the layer is missing or empty."""
    return {name: burn_median(layers[name], zones) if name in layers else None for name in GRID_COVARIATES}


def stage_share(stage: np.ndarray, zones: np.ndarray) -> list[float] | None:
    """Share of stages 0, 1, 2 among burn cells that have a stage."""
    values = stage[(zones == ZONE_BURN) & np.isfinite(stage)].astype(int)
    if not values.size:
        return None
    counts = np.bincount(values, minlength=STAGES)[:STAGES]
    return [round(float(c), 4) for c in counts / values.size]


def coverage(layer: np.ndarray, zones: np.ndarray) -> float:
    """Share of the burn zone where ``layer`` has a value."""
    burn = zones == ZONE_BURN
    return round(float(np.isfinite(layer[burn]).mean()), 4) if burn.any() else 0.0


def optics_recovery(ndvi: np.ndarray, zones: np.ndarray) -> float | None:
    """How recovered the burn looks to optics: median NDVI of the burn / median NDVI of the neighbour forest."""
    burn = ndvi[(zones == ZONE_BURN) & np.isfinite(ndvi)]
    reference = ndvi[(zones == ZONE_REFERENCE) & np.isfinite(ndvi)]
    if not burn.size or not reference.size:
        return None
    reference_median = float(np.median(reference))
    if reference_median <= 0:
        return None
    return round(float(np.median(burn)) / reference_median, 4)


def lidar_in_burn(heights: np.ndarray | None, zones: np.ndarray, grid: Grid, reference_height_m: float | None) -> dict:
    """GEDI shots inside the burn: {"lidar", "points_in_fire", "points"} for result.json.

    lidar is the mean shot height over the neighbour forest height, the same measure as the model's
    recovery. It is None with fewer than MIN_LIDAR_SHOTS shots. GEDI flew 2019-2023, so it shows
    the burn a few years before the satellite images.
    """
    if heights is None:
        return {"lidar": None, "points_in_fire": 0, "points": []}
    rows, cols = np.nonzero((zones == ZONE_BURN) & np.isfinite(heights))
    values = heights[rows, cols]
    lidar = None
    if values.size >= MIN_LIDAR_SHOTS and reference_height_m:
        lidar = round(float(values.mean() / reference_height_m), 3)

    keep = np.linspace(0, values.size - 1, min(values.size, MAX_LIDAR_POINTS)).round().astype(int) if values.size else []
    xs, ys = grid.cell_centers()
    to_lonlat = Transformer.from_crs(grid.crs, "EPSG:4326", always_xy=True)
    lons, lats = to_lonlat.transform(xs[rows[keep], cols[keep]], ys[rows[keep], cols[keep]])
    points = [
        {"lon": round(float(lon), 5), "lat": round(float(lat), 5), "height_m": round(float(h), 1)}
        for lon, lat, h in zip(np.atleast_1d(lons), np.atleast_1d(lats), values[keep])
    ]
    return {"lidar": lidar, "points_in_fire": int(values.size), "points": points}
