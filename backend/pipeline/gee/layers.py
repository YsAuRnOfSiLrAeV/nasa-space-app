"""GEE layers on the shared grid via ee.data.computePixels. Owner: Misha.

- Sentinel-1 GRD, IW, ascending, Jul 10-25, median, focalMean 30 m -> s1_VH, s1_VV (dB)
- Sentinel-2 SR Harmonized, Jul 1 - Aug 15, cloud < 20%, median, (B8-B4)/(B8+B4) -> NDVI (0..1)
- WorldCover (water / forest mask), Hansen (forest loss), MODIS (fire history)

Only month/day are fixed, the year is a parameter. Take windows from forestrecovery.feature_spec().
"""

from __future__ import annotations

from ..grid import Grid


def sentinel1(grid: Grid, year: int) -> dict:
    """Return {"s1_VH": array, "s1_VV": array} in dB on `grid`."""
    raise NotImplementedError


def ndvi(grid: Grid, year: int) -> dict:
    """Return {"NDVI": array} in 0..1 on `grid`."""
    raise NotImplementedError


def masks(grid: Grid, year: int) -> dict:
    """Return WorldCover / Hansen / MODIS layers on `grid` (used by zones.py)."""
    raise NotImplementedError
