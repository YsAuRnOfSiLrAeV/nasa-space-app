"""Common cell grid for one fire.

Every layer in the pipeline (NISAR, Sentinel-1, NDVI, masks, zones, model output)
is a 2D array of shape ``grid.shape`` that lies on this grid, so cell [row, col]
means the same patch of ground in every layer.

``make_grid`` is called once per fire by ``run_pipeline``. The other methods are
used by the layer modules:
    shape, empty()      every layer module
    cell_centers()      nisar.py (which granule pixel belongs to each cell)
    bounds              nisar.py (which window of the granule to read)
    to_grid_crs()       zones.py (fire polygon from lon/lat to grid metres)
    to_ee()             gee_layers.py (grid for Earth Engine computePixels)
    corners_lonlat()    export.py (map_grid.corners_lonlat in result.json)
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np
import shapely
from affine import Affine
from pyproj import Transformer
from shapely.geometry import MultiPolygon, Polygon, shape
from shapely.geometry.base import BaseGeometry

# Cell size in metres. Model features were computed at this resolution in training.
CELL_M = 30
# How far the grid extends beyond the fire, to include the neighbour forest ring (1.5-6 km).
RING_KM = 6.0
# Guard against bad input (e.g. a province-sized polygon). Fort McMurray with ring is ~9 M cells.
MAX_CELLS = 20_000_000


@dataclass(frozen=True)
class Grid:
    """Grid description: CRS, top-left corner, cell size, number of cells."""

    crs: str           # UTM zone of the fire, e.g. "EPSG:32610"
    transform: Affine  # cell <-> metres: x = c + col*a, y = f + row*e
    width: int         
    height: int        

    @property
    def shape(self) -> tuple[int, int]:
        """Shape of every layer for this fire: (rows, columns)."""
        return (self.height, self.width)

    @property
    def bounds(self) -> tuple[float, float, float, float]:
        """Grid edges in metres: (left, bottom, right, top)."""
        left = self.transform.c          # c: x of the left edge
        top = self.transform.f           # f: y of the top edge
        cell = self.transform.a          # a: cell width
        return (left, top - self.height * cell, left + self.width * cell, top)

    def empty(self) -> np.ndarray:
        """New layer of this grid's shape filled with NaN (no value).

        Modules fill the cells that have data. Cells left as NaN become null in cells.json.
        """
        return np.full(self.shape, np.nan, dtype=np.float32)

    def cell_centers(self) -> tuple[np.ndarray, np.ndarray]:
        """X and Y of every cell centre in grid metres, two arrays of shape ``shape``.

        +0.5 is half a cell: cell 0 spans 0..1, its centre is at 0.5.
        """
        cell = self.transform.a
        xs = self.transform.c + (np.arange(self.width) + 0.5) * cell    # x of each column centre
        ys = self.transform.f - (np.arange(self.height) + 0.5) * cell   # y of each row centre
        return np.meshgrid(xs, ys)   # expand to full 2D arrays

    def to_grid_crs(self, geom: BaseGeometry) -> BaseGeometry:
        """Reproject a lon/lat (EPSG:4326) geometry into grid metres."""
        return _reproject(geom, "EPSG:4326", self.crs)

    def corners_lonlat(self) -> list[list[float]]:
        """Grid corners in lon/lat: top-left, top-right, bottom-right, bottom-left."""
        left, bottom, right, top = self.bounds
        to_lonlat = Transformer.from_crs(self.crs, "EPSG:4326", always_xy=True)
        corners_m = [(left, top), (right, top), (right, bottom), (left, bottom)]
        result = []
        for x, y in corners_m:
            lon, lat = to_lonlat.transform(x, y)
            result.append([round(lon, 6), round(lat, 6)])   # 6 decimals is ~10 cm
        return result

    def to_ee(self) -> dict:
        """This grid in the format Earth Engine expects in computePixels."""
        t = self.transform
        return {
            "dimensions": {"width": self.width, "height": self.height},
            "affineTransform": {"scaleX": t.a, "shearX": t.b, "translateX": t.c,
                                "shearY": t.d, "scaleY": t.e, "translateY": t.f},
            "crsCode": self.crs,
        }


def make_grid(polygon: BaseGeometry | dict) -> Grid:
    """Build the grid for one fire.

    polygon: fire perimeter in lon/lat, shapely geometry or GeoJSON dict.

    Steps:
        1. UTM zone of the fire centre.
        2. Polygon from lon/lat to metres in that zone, take its edges.
        3. Extend the edges by RING_KM.
        4. Snap the edges outwards to multiples of CELL_M, so grids always line up.
        5. Count columns and rows.
    """
    geom = _as_polygon(polygon)

    # 1
    centre = geom.centroid
    crs = utm_epsg(centre.x, centre.y)

    # 2
    left, bottom, right, top = _reproject(geom, "EPSG:4326", crs).bounds

    # 3
    ring_m = RING_KM * 1000
    left, bottom, right, top = left - ring_m, bottom - ring_m, right + ring_m, top + ring_m

    # 4: left/bottom round down, right/top round up, so nothing is cut off
    left = math.floor(left / CELL_M) * CELL_M
    bottom = math.floor(bottom / CELL_M) * CELL_M
    right = math.ceil(right / CELL_M) * CELL_M
    top = math.ceil(top / CELL_M) * CELL_M

    # 5
    width = round((right - left) / CELL_M)
    height = round((top - bottom) / CELL_M)
    if width * height > MAX_CELLS:
        raise ValueError(f"grid too large: {width} x {height} cells")

    transform = Affine(CELL_M, 0, left, 0, -CELL_M, top)
    return Grid(crs=crs, transform=transform, width=width, height=height)


def utm_epsg(lon: float, lat: float) -> str:
    """EPSG code of the UTM zone for a point. Zones are 6° of longitude wide, counted from -180°."""
    zone = int((lon + 180) // 6) % 60 + 1
    return f"EPSG:{(32600 if lat >= 0 else 32700) + zone}"   # 326xx north, 327xx south


def _as_polygon(polygon: BaseGeometry | dict) -> BaseGeometry:
    """Accept GeoJSON or shapely, check it is a polygon, fix invalid geometry."""
    geom = shape(polygon) if isinstance(polygon, dict) else polygon
    if not isinstance(geom, (Polygon, MultiPolygon)) or geom.is_empty:
        raise ValueError("expected a non-empty Polygon or MultiPolygon")
    return geom if geom.is_valid else geom.buffer(0)


def _reproject(geom: BaseGeometry, src: str, dst: str) -> BaseGeometry:
    """Reproject a geometry from CRS ``src`` to CRS ``dst``."""
    tr = Transformer.from_crs(src, dst, always_xy=True)
    return shapely.transform(geom, lambda xy: np.column_stack(tr.transform(xy[:, 0], xy[:, 1])))