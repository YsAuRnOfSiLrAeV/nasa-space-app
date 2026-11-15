"""The packed fire perimeter format: geometry as whole pixels of the MODIS grid.

Global Fire Atlas perimeters follow the edges of MODIS 463 m burned-area pixels, so every vertex
sits exactly on that grid. A packed file stores each vertex as a whole pixel number, as the step from
the previous vertex, in four list columns per fire:

    part_sizes   rings per polygon part
    ring_sizes   vertices per ring
    dx, dy       pixel steps; the first value of a fire is its absolute pixel position
    exact_wkb    the original geometry of the rare fire that is not on the grid, else null

This is lossless and several times smaller than WKB. ``encode_geometry`` and ``decode_geometry``
convert between shapely geometries and those columns; ``bounds`` gives lon/lat bounding boxes
straight from the pixels, without building geometries.
"""

from __future__ import annotations

import numpy as np
import pyarrow as pa
import shapely

# MODIS sinusoidal grid: sphere radius and pixel size in metres.
EARTH_RADIUS_M = 6371007.181
PIXEL_M = 463.312716528
# A vertex farther than this from a pixel corner, in pixels, makes its fire be stored as exact WKB.
MAX_SNAP_ERROR_PX = 0.01

GEOMETRY_COLUMNS = ("part_sizes", "ring_sizes", "dx", "dy", "exact_wkb")


def encode_geometry(geometries: np.ndarray) -> dict[str, pa.Array]:
    """Polygons and multipolygons (lon/lat) -> the geometry columns of a packed file."""
    parts, feature_of_part = shapely.get_parts(geometries, return_index=True)
    multi = shapely.multipolygons(parts, indices=feature_of_part)
    _, coords, (ring_offsets, part_offsets, geom_offsets) = shapely.to_ragged_array(multi)
    vertex_offsets = ring_offsets[part_offsets[geom_offsets]]
    first = vertex_offsets[:-1]
    x, y = _to_pixels(coords)
    snap_error = np.maximum(np.abs(x - np.round(x)), np.abs(y - np.round(y)))
    off_grid = np.maximum.reduceat(snap_error, first) > MAX_SNAP_ERROR_PX
    exact = np.full(len(geometries), None, dtype=object)
    exact[off_grid] = shapely.to_wkb(geometries[off_grid])
    x, y = np.round(x).astype(np.int32), np.round(y).astype(np.int32)

    dx, dy = np.diff(x, prepend=0), np.diff(y, prepend=0)
    dx[first], dy[first] = x[first], y[first]

    return {
        "part_sizes": _lists(np.diff(part_offsets), geom_offsets),
        "ring_sizes": _lists(np.diff(ring_offsets), part_offsets[geom_offsets]),
        "dx": _lists(dx, vertex_offsets),
        "dy": _lists(dy, vertex_offsets),
        "exact_wkb": pa.array(exact, type=pa.binary()),
    }


def decode_geometry(table: pa.Table) -> np.ndarray:
    """Geometry columns -> shapely geometries: Polygon for one part, MultiPolygon for several."""
    part_sizes, geom_offsets = _flat(table["part_sizes"])
    ring_sizes, _ = _flat(table["ring_sizes"])
    x, y, _ = _pixels(table)

    offsets = (_offsets(ring_sizes), _offsets(part_sizes), geom_offsets)
    multi = shapely.from_ragged_array(shapely.GeometryType.MULTIPOLYGON, _to_degrees(x, y), offsets)
    single = shapely.get_num_geometries(multi) == 1
    multi[single] = shapely.get_geometry(multi[single], 0)
    off_grid, exact = _exact(table)
    multi[off_grid] = exact
    return multi


def bounds(table: pa.Table) -> np.ndarray:
    """(n, 4) lon/lat bounding boxes (west, south, east, north) of the fires, without building geometries."""
    x, y, vertex_offsets = _pixels(table)
    first = vertex_offsets[:-1]
    x0, x1 = np.minimum.reduceat(x, first), np.maximum.reduceat(x, first)
    y0, y1 = np.minimum.reduceat(y, first), np.maximum.reduceat(y, first)

    # Longitude of a pixel column grows away from the equator, so the box edges are reached at a corner,
    # or on the equator when the fire spans it.
    lats = [y0, y1, np.where((y0 < 0) & (y1 > 0), 0, y0)]
    lons = np.stack([_to_degrees(x_edge, lat)[:, 0] for x_edge in (x0, x1) for lat in lats])
    box = np.column_stack([lons.min(axis=0), _latitude(y0), lons.max(axis=0), _latitude(y1)])

    off_grid, exact = _exact(table)
    box[off_grid] = shapely.bounds(exact)
    return box


def _pixels(table: pa.Table) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Absolute pixel position of every vertex, and where each fire starts in those arrays."""
    dx, vertex_offsets = _flat(table["dx"])
    dy, _ = _flat(table["dy"])
    # Undo the steps: a running sum, restarted at the first vertex of every fire.
    x, y = np.cumsum(dx, dtype=np.int64), np.cumsum(dy, dtype=np.int64)
    first = vertex_offsets[:-1]
    counts = np.diff(vertex_offsets)
    x -= np.repeat(x[first] - dx[first], counts)
    y -= np.repeat(y[first] - dy[first], counts)
    return x, y, vertex_offsets


def _exact(table: pa.Table) -> tuple[np.ndarray, np.ndarray]:
    """Which fires are stored as exact WKB, and their geometries."""
    wkb = table["exact_wkb"].to_numpy(zero_copy_only=False)
    off_grid = np.array([value is not None for value in wkb], dtype=bool)
    return off_grid, shapely.from_wkb(wkb[off_grid])


def _to_pixels(lonlat: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    lat = np.radians(lonlat[:, 1])
    return EARTH_RADIUS_M * np.radians(lonlat[:, 0]) * np.cos(lat) / PIXEL_M, EARTH_RADIUS_M * lat / PIXEL_M


def _to_degrees(x: np.ndarray, y: np.ndarray) -> np.ndarray:
    lat = y * PIXEL_M / EARTH_RADIUS_M
    lon = x * PIXEL_M / (EARTH_RADIUS_M * np.cos(lat))
    return np.column_stack([np.degrees(lon), np.degrees(lat)])


def _latitude(y: np.ndarray) -> np.ndarray:
    return np.degrees(y * PIXEL_M / EARTH_RADIUS_M)


def _lists(values: np.ndarray, offsets: np.ndarray) -> pa.Array:
    return pa.ListArray.from_arrays(pa.array(offsets.astype(np.int32)), pa.array(values.astype(np.int32)))


def _flat(column: pa.ChunkedArray) -> tuple[np.ndarray, np.ndarray]:
    """Values of a list column, and offsets into them that start at 0 (also for a slice of a table)."""
    array = column.combine_chunks()
    offsets = array.offsets.to_numpy().astype(np.int64)
    return array.flatten().to_numpy(), offsets - offsets[0]


def _offsets(sizes: np.ndarray) -> np.ndarray:
    return np.concatenate([[0], np.cumsum(sizes, dtype=np.int64)])
