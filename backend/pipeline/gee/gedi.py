"""GEDI lidar heights: the reference ("100% recovery") forest height, and the shots for the burn.
The shots inside the burn get the extra filters of the training labels in fire_stats.lidar_shot_mask.

``shot_heights`` downloads the good GEDI shots on the grid once. ``reference_height`` takes the
median rh98 of good-quality GEDI shots over the reference forest (zones.py: the 1.5-6 km ring
around the WHOLE fire, unburned forest only). GEDI only reaches 51.6 N; north of that use
ETH Canopy Height, flagged as approximate.

Shot filters are the ones used in the training data collection: 2019-04-01 to 2023-03-16,
June to September only, quality_flag 1, degrade_flag 0, sensitivity >= 0.95, rh98 <= 35 m.
"""

from __future__ import annotations

import numpy as np
from shapely.geometry import shape

from ..grid import Grid
from . import client
from .zones import REFERENCE

MIN_SHOTS = 100
GEDI_MAX_LAT = 51.6
MIN_SENSITIVITY = 0.95
MAX_RH98_M = 35  # taller returns are treated as noise, as in data collection
GEDI_DATES = ("2019-04-01", "2023-03-17")  # filterDate excludes its end: last day 2023-03-16
GEDI_MONTHS = (6, 9)  # June to September: leaf-on, no snow
FIRST_GEDI_YEAR = 2019

RH98 = "rh98"
ETH_HEIGHT = "eth_height"


def shot_heights(polygon, grid: Grid) -> np.ndarray | None:
    """rh98 (m) of good GEDI shots on the grid, NaN between shots. None north of GEDI coverage."""
    return _gedi_rh98(grid) if _latitude(polygon) <= GEDI_MAX_LAT else None


def shots_after_fire(polygon, grid: Grid, fire_year: int, all_shots: np.ndarray | None) -> np.ndarray | None:
    """The shots taken in the years after the fire, for the lidar comparison inside the burn.

    GEDI flew 2019-2023, so for a fire in those years part of the shots show the forest before
    it burned. Shots of the fire year itself are dropped too, as the fire date is not known.
    ``all_shots`` (from shot_heights) is returned as is when every shot is after the fire.
    """
    if all_shots is None or fire_year < FIRST_GEDI_YEAR:
        return all_shots
    start = f"{fire_year + 1}-01-01"
    if start >= GEDI_DATES[1]:
        return np.full(grid.shape, np.nan, dtype=np.float32)
    return _gedi_rh98(grid, start)


def reference_height(polygon, grid: Grid, zones: np.ndarray, heights: np.ndarray | None = None) -> dict:
    """Return {"height_m", "source", "shots"}: median height of the reference forest.

    source is "gedi", or "eth" (approximate) north of GEDI coverage or with under MIN_SHOTS shots.
    ``heights`` are the shots from ``shot_heights``, to avoid downloading them twice.
    """
    reference = zones == REFERENCE
    if not reference.any():
        raise ValueError("no reference forest in the ring around the fire")

    if heights is None and _latitude(polygon) <= GEDI_MAX_LAT:
        heights = _gedi_rh98(grid)
    shots = np.empty(0) if heights is None else _valid(heights[reference])
    if shots.size >= MIN_SHOTS:
        return {"height_m": _median(shots), "source": "gedi", "shots": shots.size}

    eth = _valid(_eth_height(grid)[reference])
    if not eth.size:
        raise ValueError("no canopy height for the reference forest: neither GEDI nor ETH has data there")
    return {"height_m": _median(eth), "source": "eth", "shots": shots.size}


def _gedi_rh98(grid: Grid, start: str = GEDI_DATES[0]) -> np.ndarray:
    """Canopy top height (m) of good-quality GEDI L2A shots on `grid`, NaN between shots."""
    ee = client.session()

    def good_shots(image):
        rh98 = image.select(RH98)
        good = (
            image.select("quality_flag")
            .eq(1)
            .And(image.select("degrade_flag").eq(0))
            .And(image.select("sensitivity").gte(MIN_SENSITIVITY))
            .And(rh98.lte(MAX_RH98_M))
        )
        return rh98.updateMask(good)

    image = (
        ee.ImageCollection("LARSE/GEDI/GEDI02_A_002_MONTHLY")
        .filterBounds(client.region(grid))
        .filterDate(start, GEDI_DATES[1])
        .filter(ee.Filter.calendarRange(*GEDI_MONTHS, "month"))
        .map(good_shots)
        .mosaic()
    )
    return client.fetch(image, grid, [RH98])[RH98]


def _eth_height(grid: Grid) -> np.ndarray:
    """ETH Global Canopy Height 2020 (m) on `grid`."""
    ee = client.session()
    image = ee.Image("users/nlang/ETH_GlobalCanopyHeight_2020_10m_v1").rename(ETH_HEIGHT)
    return client.fetch(image, grid, [ETH_HEIGHT])[ETH_HEIGHT]


def _latitude(polygon) -> float:
    geom = shape(polygon) if isinstance(polygon, dict) else polygon
    return geom.centroid.y


def _valid(values: np.ndarray) -> np.ndarray:
    return values[np.isfinite(values)]


def _median(values: np.ndarray) -> float:
    return round(float(np.median(values)), 1)
