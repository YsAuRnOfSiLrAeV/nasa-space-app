"""NISAR backscatter (HH, HV) on the fire grid.

The model was trained on NISAR L2 GCOV values read at GEDI points. This module
reads the same values at the centre of every grid cell, with the same processing,
so the model sees inputs of the same kind:

    1. search granules over the grid for the summer, ascending passes only
    2. use the granule closest to TARGET_DAY first, the next ones only fill cells it did not image
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
from scipy.ndimage import uniform_filter

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
GCOV_GRID = "science/LSAR/GCOV/grids/frequencyA"  # where GCOV keeps HHHH, HVHV and their coordinates
BLOCK_BYTES = 8 * 2**20      # Each HTTP read fetches at least this much. HDF5 makes many small reads close together.

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
    below_floor: np.ndarray        # (rows, cols) bool: imaged, but too dark (under MIN_DB), so NaN in layers

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
    """Fill the grid from the granules in order.

    A cell is done once a granule has imaged it, even if the value is too dark to use:
    a later granule from another day would not make it brighter. So the loop stops as
    soon as every cell is imaged, which for most fires is after the first granule.
    """
    if not granules:
        raise NisarUnavailable("no ascending NISAR granules over the fire for this summer")
    hh, hv = grid.empty(), grid.empty()
    imaged = np.zeros(grid.shape, dtype=bool)
    xs, ys = grid.cell_centers()
    used = []
    for granule in granules:
        todo = ~imaged
        if not todo.any():
            break
        with _open_scene(granule) as scene:
            if scene is None:
                continue
            hh_values, hv_values, seen = _sample(scene, xs[todo], ys[todo], grid.crs)
        rows, cols = np.nonzero(todo)
        imaged[rows[seen], cols[seen]] = True
        filled = np.isfinite(hv_values)
        if filled.any():
            hh[rows[filled], cols[filled]] = hh_values[filled]
            hv[rows[filled], cols[filled]] = hv_values[filled]
            used.append(UsedGranule(granule.name, granule.day, int(filled.sum())))
    if not used:
        raise NisarUnavailable("NISAR granules found, but none has valid pixels over the fire")
    return NisarLayers({NISAR_HH: hh, NISAR_HV: hv}, used, below_floor=imaged & np.isnan(hv))


def _sample(scene: Scene, xs: np.ndarray, ys: np.ndarray, crs: str) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """HH and HV in dB at points (grid metres), and which points the granule imaged.

    HH and HV are NaN where there is no usable value. ``imaged`` is True where the
    granule has data around the point, including values too dark to use.
    """
    to_scene = Transformer.from_crs(crs, f"EPSG:{scene.epsg}", always_xy=True)
    px, py = to_scene.transform(xs, ys)
    cols = np.round((px - scene.x[0]) / (scene.x[1] - scene.x[0])).astype(np.int64)
    rows = np.round((py - scene.y[0]) / (scene.y[1] - scene.y[0])).astype(np.int64)

    hh = np.full(xs.shape, np.nan, dtype=np.float32)
    hv = np.full(xs.shape, np.nan, dtype=np.float32)
    imaged = np.zeros(xs.shape, dtype=bool)
    # One pixel of margin, so the 3x3 window of every sampled pixel lies inside the granule.
    inside = (rows >= 1) & (rows < len(scene.y) - 1) & (cols >= 1) & (cols < len(scene.x) - 1)
    if not inside.any():
        return hh, hv, imaged

    # Read only the window that covers the points, not the whole granule.
    r0, r1 = rows[inside].min() - 1, rows[inside].max() + 2
    c0, c1 = cols[inside].min() - 1, cols[inside].max() + 2
    r, c = rows[inside] - r0, cols[inside] - c0
    hh_db = _db(_mean3x3(scene.hh[r0:r1, c0:c1])[r, c])
    hv_db = _db(_mean3x3(scene.hv[r0:r1, c0:c1])[r, c])
    imaged[inside] = np.isfinite(hh_db) & np.isfinite(hv_db)

    # Same rule as in training: HV below MIN_DB is dropped, HH must be above it.
    ok = (hv_db >= MIN_DB) & (hh_db > MIN_DB)
    hh[inside] = np.where(ok, hh_db, np.nan)
    hv[inside] = np.where(ok, hv_db, np.nan)
    return hh, hv, imaged


def _mean3x3(window: np.ndarray) -> np.ndarray:
    """Mean of each 3x3 neighbourhood in linear units, ignoring zeros and NaN (no data).

    Two running-window filters (sum of values, count of valid pixels) instead of nine
    shifted copies, so memory stays at a few copies of the window even for large fires.
    """
    a = np.asarray(window, dtype=np.float32)
    valid = (a > 0) & np.isfinite(a)
    mean_value = uniform_filter(np.where(valid, a, 0).astype(np.float32), size=3, mode="constant", cval=0.0)
    mean_valid = uniform_filter(valid.astype(np.float32), size=3, mode="constant", cval=0.0)
    with np.errstate(invalid="ignore", divide="ignore"):
        # Both are divided by 9 inside the filter, so their ratio is sum / count.
        return np.where(mean_valid > 0.5 / 9, mean_value / mean_valid, np.nan)


def _db(linear: np.ndarray) -> np.ndarray:
    with np.errstate(invalid="ignore", divide="ignore"):
        return (10 * np.log10(linear)).astype(np.float32)


@contextmanager
def _open_scene(granule: Granule) -> Iterator[Scene | None]:
    """Open a granule and find its HH/HV bands. Yields None when the granule has no such bands."""
    with _open(granule) as raw, h5py.File(raw, "r") as f:
        yield _find_bands(f)


def _find_bands(f: h5py.File) -> Scene | None:
    group = GCOV_GRID if f.get(f"{GCOV_GRID}/HHHH") is not None and f.get(f"{GCOV_GRID}/HVHV") is not None else _search_bands(f)
    if group is None:
        return None
    projection = f[group + "/projection"]
    epsg = projection.attrs.get("epsg_code")
    if epsg is None:
        epsg = projection[()]
    return Scene(
        hh=f[group + "/HHHH"],
        hv=f[group + "/HVHV"],
        x=f[group + "/xCoordinates"][:],
        y=f[group + "/yCoordinates"][:],
        epsg=int(np.ravel(epsg)[0]),
    )


def _search_bands(f: h5py.File) -> str | None:
    """Group holding frequencyA HHHH and HVHV, found by walking the whole file.

    Only a fallback for files laid out differently: over HTTP every visited object costs a request.
    """
    paths: list[str] = []
    f.visit(paths.append)
    hh = next((p for p in paths if p.endswith("frequencyA/HHHH")), None)
    hv = next((p for p in paths if p.endswith("frequencyA/HVHV")), None)
    if hh is None or hv is None or hh.rsplit("/", 1)[0] != hv.rsplit("/", 1)[0]:
        return None
    return hh.rsplit("/", 1)[0]


def _open(granule: Granule) -> IO[bytes]:
    """File-like object that reads the granule over HTTPS in BLOCK_BYTES blocks.

    The Earthdata URL redirects to a signed CloudFront URL, and a request through that
    redirect takes seconds. The redirect is followed once here, then every read goes
    straight to the signed URL. Only the blocks that are read are downloaded, never the
    whole file (several GB).
    """
    import fsspec

    links = [link for link in granule.result.data_links(access="external") if link.endswith(".h5")]
    if not links:
        raise NisarUnavailable(f"no HDF5 download link for {granule.name}")
    # Follow the redirect with a one-byte GET, not HEAD: the server signs the URL for the
    # request method, and a URL signed for HEAD is refused (403) for the GETs that follow.
    session = _earthaccess().get_requests_https_session()
    with session.get(links[0], headers={"Range": "bytes=0-0"}, allow_redirects=True, stream=True, timeout=60) as first:
        first.raise_for_status()
        signed_url = first.url
        size = int(first.headers["content-range"].rsplit("/", 1)[1])  # "bytes 0-0/<total size>"
    https = fsspec.filesystem("https", encoded=True)  # the signed URL must be sent exactly as given
    return https.open(signed_url, block_size=BLOCK_BYTES, cache_type="blockcache", size=size)


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
