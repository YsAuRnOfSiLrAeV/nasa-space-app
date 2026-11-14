"""Shared grid ("one sheet of cells") that every data source is resampled onto. Owner: Yaroslav."""

from __future__ import annotations

from dataclasses import dataclass

RING_M = 6000  # border around the fire, to capture neighbouring forest


@dataclass(frozen=True)
class Grid:
    crs: str  # UTM zone, e.g. "EPSG:32610"
    x0: float  # top-left corner, metres in crs
    y0: float
    cell_size: float  # metres
    rows: int
    cols: int

    @property
    def shape(self) -> tuple[int, int]:
        return (self.rows, self.cols)


def make_grid(polygon, cell_size: float = 30.0) -> Grid:
    """Build the grid covering `polygon` (lon/lat) plus a RING_M ring.

    The UTM zone is chosen from the polygon centroid.
    """
    raise NotImplementedError
