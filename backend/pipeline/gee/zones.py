"""Cell zones for the cells.json `zone` field. Owner: Misha.

- burn: cell inside the fire polygon
- reference forest: ring cell, not burned since 2001, not logged, forest now
- excluded: everything else in the ring (water, roads, clearcuts, other burns)

Zone codes come from the result format (DELIVERABLES, tab 1).
"""

from __future__ import annotations

import numpy as np
import shapely
from shapely.geometry import shape
from shapely.geometry.base import BaseGeometry

from ..grid import Grid
from .layers import BURNED, LOGGED, WORLDCOVER

BURN = 1
REFERENCE = 0
# Excluded cells stay NaN, which becomes null in cells.json.

WORLDCOVER_TREES = 10


def make_zones(polygon, grid: Grid, masks: dict) -> np.ndarray:
    """Return a (rows, cols) zone array: BURN, REFERENCE or NaN (excluded)."""
    burn = cells_within(fire_on_grid(polygon, grid), grid)
    forest = masks[WORLDCOVER] == WORLDCOVER_TREES
    reference = ~burn & forest & (masks[LOGGED] == 0) & (masks[BURNED] == 0)

    zones = grid.empty()
    zones[reference] = REFERENCE
    zones[burn] = BURN
    return zones


def fire_on_grid(polygon: BaseGeometry | dict, grid: Grid) -> BaseGeometry:
    """Fire perimeter (lon/lat, shapely or GeoJSON) in grid metres."""
    geom = shape(polygon) if isinstance(polygon, dict) else polygon
    return grid.to_grid_crs(geom)


def cells_within(area: BaseGeometry, grid: Grid) -> np.ndarray:
    """Boolean (rows, cols) array: cells whose centre lies inside `area` (grid metres)."""
    return shapely.contains_xy(area, *grid.cell_centers())
