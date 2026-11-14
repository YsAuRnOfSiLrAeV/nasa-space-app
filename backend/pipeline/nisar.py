"""NISAR L2 GCOV from NASA Earthdata onto the shared grid. Owner: Yaroslav.

Product: NISAR_L2_GCOV_PROVISIONAL_V1, frequencyA/HVHV and frequencyA/HHHH, ascending pass.
Scene: Jul 1 - Aug 31 of the chosen year, closest to Jul 17, covering the fire.
Resampling: 3x3 mean in LINEAR power, then 10*log10 -> dB.
Take the date window from forestrecovery.feature_spec().
"""

from __future__ import annotations

from .grid import Grid


def find_scene(polygon, year: int):
    """Find the summer GCOV granule closest to Jul 17 that covers the polygon."""
    raise NotImplementedError


def read_to_grid(scene, grid: Grid) -> dict:
    """Return {"nisar_HV": array, "nisar_HH": array} in dB on `grid`, NaN where invalid."""
    raise NotImplementedError
