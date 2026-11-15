"""Cell zones for the cells.json `zone` field. Owner: Misha.

- burn: cell inside the fire polygon, except water
- reference forest: cell in the 1.5-6 km ring, not burned, no forest loss, forest now
- excluded: everything else (water, roads, clearcuts, other burns, cells outside the ring)

This array is the single definition of "reference forest": gedi.py and the optics
comparison read it as is. Zone codes come from the result format (DELIVERABLES, tab 1).
"""

from __future__ import annotations

import numpy as np
import shapely
from shapely.geometry import shape
from shapely.geometry.base import BaseGeometry

from ..grid import Grid
from .layers import BURNED, FOREST_LOSS, WORLDCOVER

BURN = 1
REFERENCE = 0
# Excluded cells stay NaN, which becomes null in cells.json.

# Reference forest lies this far from the fire edge: not right next to it, not too far.
RING_INNER_M = 1500
RING_OUTER_M = 6000

WORLDCOVER_TREES = 10
WORLDCOVER_WATER = 80


def make_zones(polygon, grid: Grid, masks: dict) -> np.ndarray:
    """Return a (rows, cols) zone array: BURN, REFERENCE or NaN (excluded)."""
    fire = _fire_on_grid(polygon, grid)
    ring = fire.buffer(RING_OUTER_M).difference(fire.buffer(RING_INNER_M))

    burn = _cells_within(fire, grid) & (masks[WORLDCOVER] != WORLDCOVER_WATER)
    undisturbed_forest = (masks[WORLDCOVER] == WORLDCOVER_TREES) & (masks[FOREST_LOSS] == 0) & (masks[BURNED] == 0)
    reference = _cells_within(ring, grid) & undisturbed_forest

    zones = grid.empty()
    zones[reference] = REFERENCE
    zones[burn] = BURN
    return zones


def _fire_on_grid(polygon: BaseGeometry | dict, grid: Grid) -> BaseGeometry:
    """Fire perimeter (lon/lat, shapely or GeoJSON) in grid metres."""
    geom = shape(polygon) if isinstance(polygon, dict) else polygon
    return grid.to_grid_crs(geom)


def _cells_within(area: BaseGeometry, grid: Grid) -> np.ndarray:
    """Boolean (rows, cols) array: cells whose centre lies inside `area` (grid metres)."""
    return shapely.contains_xy(area, *grid.cell_centers())
