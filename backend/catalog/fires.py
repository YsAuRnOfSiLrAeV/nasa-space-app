"""Search the packed fire catalog by area and attributes.

The catalog is a folder of packed Parquet files (see packed.py), one per year, about 12 million
fires in all. Finding the fires under a drawn polygon takes two steps:

    1. an in-memory index holds one bounding box, year and size per fire. Comparing the polygon's
       box with all of them is a few vectorised comparisons.
    2. only the candidates that pass are read from disk, row group by row group in parallel, and
       tested against the polygon exactly.

The index is built on first use from the Parquet files and saved next to them as ``index.npz``.
It is rebuilt when the set of files changes.
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import pyarrow.parquet as pq
import shapely
from shapely.geometry import mapping
from shapely.geometry.base import BaseGeometry

from . import packed

ID_PREFIX = "gfa_"
INDEX_FILE = "index.npz"
INDEX_COLUMNS = ["fire_ID", "size", "start_date", "tier", "dx", "dy", "exact_wkb"]
FIRE_COLUMNS = ["fire_ID", "lat", "lon", "size", "start_date", "end_date", "tier", *packed.GEOMETRY_COLUMNS]
# Above this many candidates only the largest are tested exactly, to keep a search within seconds.
MAX_CANDIDATES = 20_000
HA_PER_KM2 = 100
EPOCH = date(1970, 1, 1)


class CatalogMissing(RuntimeError):
    """No packed fire files in the catalog folder."""


@dataclass(frozen=True)
class Fire:
    id: str
    year: int
    start_date: str
    end_date: str
    area_ha: float
    center: tuple[float, float]  # lon, lat
    tier: str | None  # model region tier: "A" verified, "B" extrapolated
    geometry: BaseGeometry

    @property
    def perimeter(self) -> dict:
        return mapping(self.geometry)


@dataclass(frozen=True)
class Filters:
    year_from: int | None = None
    year_to: int | None = None
    min_area_ha: float | None = None


@dataclass(frozen=True)
class SearchResult:
    fires: list[Fire]  # largest first, at most ``limit``
    total: int  # fires that overlap the area and pass the filters
    truncated: bool  # True when there were too many candidates to test them all


class FireCatalog:
    def __init__(self, directory: Path | str):
        self.directory = Path(directory)
        self.files = sorted(self.directory.glob("*.parquet"))
        if not self.files:
            raise CatalogMissing(f"no packed fire files (*.parquet) in {self.directory}")
        index = self._load_index() or self._build_index()
        self.fire_id: np.ndarray = index["fire_id"]
        self.year: np.ndarray = index["year"]
        self.area_ha: np.ndarray = index["area_ha"]
        self.bounds: np.ndarray = index["bounds"]  # (n, 4) west, south, east, north
        self.file: np.ndarray = index["file_number"]  # which file each fire is in
        self.row: np.ndarray = index["row"]  # its row in that file
        self._by_id = np.argsort(self.fire_id, kind="stable")
        # Where each row group of each file starts, to turn a row into (row group, row inside it).
        self._group_starts = [_group_starts(path) for path in self.files]

    def __len__(self) -> int:
        return len(self.fire_id)

    @property
    def years(self) -> tuple[int, int]:
        return int(self.year.min()), int(self.year.max())

    def search(self, area: BaseGeometry, filters: Filters = Filters(), limit: int = 100) -> SearchResult:
        """Fires whose perimeter overlaps ``area`` (lon/lat) and pass the filters, largest first."""
        west, south, east, north = area.bounds
        b = self.bounds
        keep = (b[:, 0] <= east) & (b[:, 2] >= west) & (b[:, 1] <= north) & (b[:, 3] >= south)
        if filters.year_from is not None:
            keep &= self.year >= filters.year_from
        if filters.year_to is not None:
            keep &= self.year <= filters.year_to
        if filters.min_area_ha is not None:
            keep &= self.area_ha >= filters.min_area_ha

        candidates = np.nonzero(keep)[0]
        candidates = candidates[np.argsort(-self.area_ha[candidates], kind="stable")]
        truncated = len(candidates) > MAX_CANDIDATES
        fires = self._read(candidates[:MAX_CANDIDATES])

        shapely.prepare(area)
        overlapping, seen = [], set()
        for fire in fires:
            # The atlas lists a few fires twice; the first one met is the larger.
            if fire.id not in seen and shapely.intersects(area, fire.geometry):
                seen.add(fire.id)
                overlapping.append(fire)
        return SearchResult(overlapping[:limit], len(overlapping), truncated)

    def get(self, fire_id: str) -> Fire | None:
        """One fire by its catalog id (``gfa_<number>``), or None."""
        if not fire_id.startswith(ID_PREFIX) or not fire_id[len(ID_PREFIX) :].isdigit():
            return None
        number = int(fire_id[len(ID_PREFIX) :])
        ordered = self.fire_id[self._by_id]
        first, last = np.searchsorted(ordered, number, "left"), np.searchsorted(ordered, number, "right")
        if first == last:
            return None
        matches = self._by_id[first:last]
        return self._read(matches[np.argmax(self.area_ha[matches])][None])[0]

    def _read(self, indices: np.ndarray) -> list[Fire]:
        """The fires at these index positions, in the same order."""
        files = self.file[indices]
        groups = np.array([np.searchsorted(self._group_starts[f], r, "right") - 1 for f, r in zip(files, self.row[indices])], dtype=np.int64)
        batches = {}
        for position, key in enumerate(zip(files.tolist(), groups.tolist())):
            batches.setdefault(key, []).append(position)

        def read(item) -> list[tuple[int, Fire]]:
            (file, group), positions = item
            rows = self.row[indices[positions]] - self._group_starts[file][group]
            table = pq.ParquetFile(self.files[file]).read_row_group(group, columns=FIRE_COLUMNS).take(rows)
            return list(zip(positions, _fires(table)))

        out: list[Fire | None] = [None] * len(indices)
        with ThreadPoolExecutor(max_workers=8) as pool:
            for batch in pool.map(read, batches.items()):
                for position, fire in batch:
                    out[position] = fire
        return out  # type: ignore[return-value]

    # ---- index -------------------------------------------------------------------------------

    def _signature(self) -> str:
        return "|".join(f"{path.name}:{path.stat().st_size}" for path in self.files)

    def _load_index(self) -> dict | None:
        path = self.directory / INDEX_FILE
        if not path.exists():
            return None
        with np.load(path) as saved:
            if str(saved["signature"]) != self._signature():
                return None
            return {name: saved[name] for name in saved.files}

    def _build_index(self) -> dict:
        parts: dict[str, list[np.ndarray]] = {name: [] for name in ("fire_id", "year", "area_ha", "bounds", "file_number", "row")}
        for number, path in enumerate(self.files):
            table = pq.read_table(path, columns=INDEX_COLUMNS)
            start_day = table["start_date"].combine_chunks().cast("int32").to_numpy()
            parts["fire_id"].append(table["fire_ID"].to_numpy())
            parts["year"].append(start_day.astype("datetime64[D]").astype("datetime64[Y]").astype(np.int16) + 1970)
            parts["area_ha"].append((table["size"].to_numpy() * HA_PER_KM2).astype(np.float32))
            parts["bounds"].append(packed.bounds(table).astype(np.float32))
            parts["file_number"].append(np.full(table.num_rows, number, dtype=np.int16))
            parts["row"].append(np.arange(table.num_rows, dtype=np.int32))
        index = {name: np.concatenate(chunks) for name, chunks in parts.items()}
        np.savez_compressed(self.directory / INDEX_FILE, signature=self._signature(), **index)
        return index


def _group_starts(path: Path) -> np.ndarray:
    metadata = pq.ParquetFile(path).metadata
    sizes = [metadata.row_group(i).num_rows for i in range(metadata.num_row_groups)]
    return np.concatenate([[0], np.cumsum(sizes)[:-1]]).astype(np.int64)


def _fires(table) -> list[Fire]:
    geometries = packed.decode_geometry(table)
    columns = {name: table[name].to_pylist() for name in FIRE_COLUMNS[:7]}
    return [
        Fire(
            id=f"{ID_PREFIX}{columns['fire_ID'][i]}",
            year=columns["start_date"][i].year,
            start_date=columns["start_date"][i].isoformat(),
            end_date=columns["end_date"][i].isoformat(),
            area_ha=round(columns["size"][i] * HA_PER_KM2, 1),
            center=(round(columns["lon"][i], 4), round(columns["lat"][i], 4)),
            tier=columns["tier"][i],
            geometry=geometries[i],
        )
        for i in range(table.num_rows)
    ]


def days_to_date(days: int) -> date:
    return EPOCH + timedelta(days=int(days))
