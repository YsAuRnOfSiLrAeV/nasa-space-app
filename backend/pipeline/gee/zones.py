"""Cell zones for the cells.json `zone` field. Owner: Misha.

- burn: cell inside the fire polygon
- reference forest: ring cell, not burned since 2001, not logged, forest now
- excluded: everything else in the ring (water, roads, clearcuts, other burns)

Zone codes come from the result format (DELIVERABLES, tab 1).
"""

from __future__ import annotations

from ..grid import Grid


def make_zones(polygon, grid: Grid, masks: dict):
    """Return a (rows, cols) zone array."""
    raise NotImplementedError
