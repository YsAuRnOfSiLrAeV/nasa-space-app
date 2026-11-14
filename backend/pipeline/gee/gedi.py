"""Reference ("100% recovery") forest height from GEDI. Owner: Misha.

GEDI shots in the 1.5-6 km ring around the WHOLE fire, unburned forest only, quality filters,
median rh98. GEDI only reaches 51.6 N; north of that use ETH Canopy Height, flagged as approximate.
"""

from __future__ import annotations

import numpy as np
from shapely.geometry import shape

from ..grid import Grid
from . import client
from .zones import REFERENCE, cells_within, fire_on_grid

RING_INNER_M = 1500
RING_OUTER_M = 6000
MIN_SHOTS = 100
GEDI_MAX_LAT = 51.6
MIN_SENSITIVITY = 0.9

RH98 = "rh98"
ETH_HEIGHT = "eth_height"


def reference_height(polygon, grid: Grid, zones: np.ndarray) -> dict:
    """Return {"height_m", "source", "shots"}: median height of the reference forest in the ring.

    source is "gedi", or "eth" (approximate) north of GEDI coverage or with under MIN_SHOTS shots.
    """
    fire = fire_on_grid(polygon, grid)
    ring = fire.buffer(RING_OUTER_M).difference(fire.buffer(RING_INNER_M))
    reference = (zones == REFERENCE) & cells_within(ring, grid)
    if not reference.any():
        raise ValueError("no reference forest in the ring around the fire")

    shots = np.empty(0)
    if _latitude(polygon) <= GEDI_MAX_LAT:
        shots = _valid(_gedi_rh98(grid)[reference])
    if shots.size >= MIN_SHOTS:
        return {"height_m": _median(shots), "source": "gedi", "shots": shots.size}
    return {"height_m": _median(_valid(_eth_height(grid)[reference])), "source": "eth", "shots": shots.size}


def _gedi_rh98(grid: Grid) -> np.ndarray:
    """Canopy top height (m) of good-quality GEDI L2A shots on `grid`, NaN between shots."""
    ee = client.session()

    def good_shots(image):
        good = (
            image.select("quality_flag")
            .eq(1)
            .And(image.select("degrade_flag").eq(0))
            .And(image.select("sensitivity").gte(MIN_SENSITIVITY))
        )
        return image.select(RH98).updateMask(good)

    region = ee.Geometry.Rectangle(list(grid.bounds), grid.crs, False)
    image = ee.ImageCollection("LARSE/GEDI/GEDI02_A_002_MONTHLY").filterBounds(region).map(good_shots).mosaic()
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


def _median(values: np.ndarray) -> float | None:
    return round(float(np.median(values)), 1) if values.size else None
