"""NISAR backscatter (HH, HV) on the fire grid.

The model was trained on NISAR L2 GCOV values read at GEDI points. This module
reads the same values at the centre of every grid cell, with the same processing,
so the model sees inputs of the same kind:

    1. search granules over the grid for the summer, ascending passes only
    2. use the granule closest to TARGET_DAY first, the next ones only fill gaps
    3. for each cell take the nearest NISAR pixel to the cell centre
    4. mean of the 3x3 window around it in linear units, then dB
    5. drop values below MIN_DB (granule edge or no data)

``nisar_layers`` is called once per fire by ``run_pipeline``. ``find_granules`` is
also public, so the API can tell which summers have NISAR data before a run.
Search and file access (``find_granules``, ``_open``) talk to NASA Earthdata.
Everything after that works on arrays and is covered by tests without network access.
"""
from __future__ import annotations

import os
import re
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import date
from functools import lru_cache
from typing import IO, TYPE_CHECKING, Iterator

import h5py
import numpy as np
from pyproj import Transformer

from .contract import NISAR_HH, NISAR_HV
from .grid import Grid

if TYPE_CHECKING:
    # Only for type checking: earthaccess is imported lazily at runtime, see _earthaccess().
    from earthaccess.results import DataGranule

PRODUCT = "NISAR_L2_GCOV_PROVISIONAL_V1"
SEASON = ("07-01", "08-31")  # Search window, both days included. Same as in training.
TARGET_DAY = "07-17"         # Granules closest to this day are used first. Same as in training.
PASS = "A"                   # Ascending only, like Sentinel-1 in training.
MIN_DB = -25.0               # Below this the pixel is a granule edge or has no data. Same cut as in training.
MAX_GRANULES = 200           # Search limit. A summer over one fire returns far fewer.

__all__ = ["Granule", "NisarLayers", "NisarUnavailable", "UsedGranule", "find_granules", "nisar_layers"]

_DATE = re.compile(r"_(\d{8})T\d{6}_")


class NisarUnavailable(RuntimeError):
    """No usable NISAR granule over the fire for this summer."""


@dataclass(frozen=True)
class Granule:
    """One search result: GCOV granule name, acquisition day and the search result used to open the file."""
    name: str
    day: date
    result: DataGranule


@dataclass(frozen=True)
class UsedGranule:
    """A granule that filled some cells, for satellite_images.nisar in result.json."""
    name: str
    day: date
    cells: int


@dataclass(frozen=True)
class NisarLayers:
    layers: dict[str, np.ndarray]  # {NISAR_HH: (rows, cols), NISAR_HV: (rows, cols)}, dB, NaN = no value
    granules: list[UsedGranule]    # in the order they were used

    @property
    def main_day(self) -> date | None:
        """Day of the granule that filled the most cells."""
        if not self.granules:
            return None
        return max(self.granules, key=lambda g: g.cells).day


@dataclass(frozen=True)
class Scene:
    """Bands and pixel-centre coordinates of one opened granule."""
    hh: h5py.Dataset   # read lazily: only the requested window is fetched
    hv: h5py.Dataset
    x: np.ndarray      # pixel centres, metres
    y: np.ndarray
    epsg: int


def nisar_layers(grid: Grid, summer: int) -> NisarLayers:
    """NISAR HH and HV in dB on ``grid`` for the given summer."""
    return _read_to_grid(find_granules(grid, summer), grid)


def find_granules(grid: Grid, summer: int) -> list[Granule]:
    """Ascending GCOV granules over the grid for the summer, closest to TARGET_DAY first."""
    ea = _earthaccess()
    lons, lats = zip(*grid.corners_lonlat())
    results = ea.search_data(
        short_name=PRODUCT,
        bounding_box=(min(lons), min(lats), max(lons), max(lats)),
        temporal=(f"{summer}-{SEASON[0]}", f"{summer}-{SEASON[1]}"),
        count=MAX_GRANULES,
    )
    return _order_granules([(r["umm"]["GranuleUR"], r) for r in results], summer)


def _order_granules(items: list[tuple[str, DataGranule]], summer: int) -> list[Granule]:
    """Keep ascending passes with a readable date, sort by distance to TARGET_DAY."""
    target = date.fromisoformat(f"{summer}-{TARGET_DAY}")
    granules = []
    for name, result in items:
        day = _day(name)
        if day is not None and _pass(name) == PASS:
            granules.append(Granule(name, day, result))
    return sorted(granules, key=lambda g: abs((g.day - target).days))


def _read_to_grid(granules: list[Granule], grid: Grid) -> NisarLayers:
    """Fill the grid from the granules in order. Each granule only fills cells that are still empty."""
    if not granules:
        raise NisarUnavailable("no ascending NISAR granules over the fire for this summer")
    hh, hv = grid.empty(), grid.empty()
    xs, ys = grid.cell_centers()
    used = []
    for granule in granules:
        todo = np.isnan(hv)
        if not todo.any():
            break
        with _open_scene(granule) as scene:
            if scene is None:
                continue
            hh_values, hv_values = _sample(scene, xs[todo], ys[todo], grid.crs)
        filled = np.isfinite(hv_values)
        if not filled.any():
            continue
        rows, cols = np.nonzero(todo)
        hh[rows[filled], cols[filled]] = hh_values[filled]
        hv[rows[filled], cols[filled]] = hv_values[filled]
        used.append(UsedGranule(granule.name, granule.day, int(filled.sum())))
    if not used:
        raise NisarUnavailable("NISAR granules found, but none has valid pixels over the fire")
    return NisarLayers({NISAR_HH: hh, NISAR_HV: hv}, used)


def _sample(scene: Scene, xs: np.ndarray, ys: np.ndarray, crs: str) -> tuple[np.ndarray, np.ndarray]:
    """HH and HV in dB at points (grid metres), NaN where the granule has no valid value."""
    to_scene = Transformer.from_crs(crs, f"EPSG:{scene.epsg}", always_xy=True)
    px, py = to_scene.transform(xs, ys)
    cols = np.round((px - scene.x[0]) / (scene.x[1] - scene.x[0])).astype(np.int64)
    rows = np.round((py - scene.y[0]) / (scene.y[1] - scene.y[0])).astype(np.int64)

    hh = np.full(xs.shape, np.nan, dtype=np.float32)
    hv = np.full(xs.shape, np.nan, dtype=np.float32)
    # One pixel of margin, so the 3x3 window of every sampled pixel lies inside the granule.
    inside = (rows >= 1) & (rows < len(scene.y) - 1) & (cols >= 1) & (cols < len(scene.x) - 1)
    if not inside.any():
        return hh, hv

    # Read only the window that covers the points, not the whole granule.
    r0, r1 = rows[inside].min() - 1, rows[inside].max() + 2
    c0, c1 = cols[inside].min() - 1, cols[inside].max() + 2
    r, c = rows[inside] - r0, cols[inside] - c0
    hh_db = _db(_mean3x3(scene.hh[r0:r1, c0:c1])[r, c])
    hv_db = _db(_mean3x3(scene.hv[r0:r1, c0:c1])[r, c])

    # Same rule as in training: HV below MIN_DB is dropped, HH must be above it.
    ok = (hv_db >= MIN_DB) & (hh_db > MIN_DB)
    hh[inside] = np.where(ok, hh_db, np.nan)
    hv[inside] = np.where(ok, hv_db, np.nan)
    return hh, hv


def _mean3x3(window: np.ndarray) -> np.ndarray:
    """Mean of each 3x3 neighbourhood in linear units, ignoring zeros and NaN (no data)."""
    a = np.asarray(window, dtype=np.float64)
    a = np.where((a > 0) & np.isfinite(a), a, np.nan)
    padded = np.pad(a, 1, constant_values=np.nan)
    h, w = a.shape
    stack = np.stack([padded[i : i + h, j : j + w] for i in range(3) for j in range(3)])
    total = np.nansum(stack, axis=0)
    count = np.isfinite(stack).sum(axis=0)
    with np.errstate(invalid="ignore", divide="ignore"):
        return np.where(count > 0, total / count, np.nan)


def _db(linear: np.ndarray) -> np.ndarray:
    with np.errstate(invalid="ignore", divide="ignore"):
        return (10 * np.log10(linear)).astype(np.float32)


@contextmanager
def _open_scene(granule: Granule) -> Iterator[Scene | None]:
    """Open a granule and find its HH/HV bands. Yields None when the granule has no such bands."""
    with h5py.File(_open(granule), "r") as f:
        yield _find_bands(f)


def _find_bands(f: h5py.File) -> Scene | None:
    paths: list[str] = []
    f.visit(paths.append)
    hh = next((p for p in paths if p.endswith("frequencyA/HHHH")), None)
    hv = next((p for p in paths if p.endswith("frequencyA/HVHV")), None)
    if hh is None or hv is None:
        return None
    group = hh.rsplit("/", 1)[0]
    projection = f[group + "/projection"]
    epsg = projection.attrs.get("epsg_code")
    if epsg is None:
        epsg = projection[()]
    return Scene(
        hh=f[hh],
        hv=f[hv],
        x=f[group + "/xCoordinates"][:],
        y=f[group + "/yCoordinates"][:],
        epsg=int(np.ravel(epsg)[0]),
    )


def _open(granule: Granule) -> IO[bytes]:
    """File-like object for the granule, streamed from Earthdata (only the read windows are fetched)."""
    return _earthaccess().open([granule.result])[0]


@lru_cache(maxsize=1)
def _earthaccess():
    """Logged-in earthaccess module. Needs EARTHDATA_USERNAME and EARTHDATA_PASSWORD (see README)."""
    import earthaccess
    from dotenv import load_dotenv

    load_dotenv()
    if not (os.environ.get("EARTHDATA_USERNAME") and os.environ.get("EARTHDATA_PASSWORD")):
        raise RuntimeError("EARTHDATA_USERNAME and EARTHDATA_PASSWORD are not set, see backend/README.md")
    earthaccess.login(strategy="environment")
    return earthaccess


def _day(name: str) -> date | None:
    match = _DATE.search(name)
    if match is None:
        return None
    s = match.group(1)
    return date(int(s[:4]), int(s[4:6]), int(s[6:]))


def _pass(name: str) -> str | None:
    """Pass direction from the granule name (A or D), as used in the training scripts."""
    parts = name.split("_")
    return parts[6] if len(parts) > 6 else None
