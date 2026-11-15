"""Write a fire result in the agreed file format (Deliverables, tab 1).

For every fire the pipeline writes a folder next to a shared index:

    <out>/index.json                  list of computed fires for the globe
    <out>/<fire_id>/result.json       everything about the fire except per-cell values
    <out>/<fire_id>/cells.json        per-cell values, flat arrays of length rows x columns
    <out>/<fire_id>/optical.png       optional Sentinel-2 picture of the fire

Layers are computed on the 30 m grid, which is too fine to send to a browser for
large fires. Before writing, cells are merged into display cells of FACTOR x FACTOR
grid cells, growing FACTOR until the display grid has at most MAX_DISPLAY_CELLS.
Categories (stage, zone) take the most common value in the block, continuous values
(probability, NDVI) take the median. A display cell gets a value only if at least
MIN_VALID_SHARE of its grid cells have one. When the zone layer is given, a display
cell on the fire edge takes its zone from the majority of its grid cells, and every
other layer in that display cell uses only the grid cells of that zone, so burn and
neighbour forest values are not mixed.

``run_pipeline`` builds the result dict and the 30 m layers, then calls
``write_fire`` and ``update_index``.
"""
from __future__ import annotations

import json
import math
import os
import warnings
from pathlib import Path
from typing import Any, Mapping

import numpy as np
from affine import Affine
from shapely.geometry import shape

from .grid import CELL_M, Grid

SCHEMA_VERSION = 1
BASE_FACTOR = 3               # 3 x 3 grid cells = 90 m display cells
MAX_DISPLAY_CELLS = 500_000   # keeps cells.json at a few MB per layer for the largest fires
MIN_VALID_SHARE = 0.5         # a display cell needs values in at least half of its grid cells

MODE, MEDIAN = "mode", "median"
ZONE_LAYER = ("map", "zone")

# Every layer cells.json may hold: (group, name) -> (how blocks are merged, multiplier before rounding).
# Inputs are fractions (0..1) or NDVI (-1..1). cells.json stores percent (x 100) as integers.
CELL_LAYERS: dict[tuple[str, str], tuple[str, int]] = {
    ("model", "stage"): (MODE, 1),
    ("model", "p_forest_gt5"): (MEDIAN, 100),
    ("model", "recovery"): (MEDIAN, 100),
    ("map", "zone"): (MODE, 1),
    ("map", "confidence"): (MODE, 1),
    ("map", "reburn_year"): (MODE, 1),
    ("optics", "ndvi"): (MEDIAN, 100),
}

# Top-level sections result.json must have before it is written. Sections that
# do not apply to a fire (for example growth_forecast outside Canada) are present with null.
RESULT_SECTIONS = (
    "fire", "satellite_images", "map_grid", "neighbour_forest", "model_result",
    "growth_forecast", "comparison", "lidar_points", "warnings",
)


def display_factor(grid: Grid) -> int:
    """Grid cells per display cell side: BASE_FACTOR, or more for large fires."""
    factor = BASE_FACTOR
    while math.ceil(grid.width / factor) * math.ceil(grid.height / factor) > MAX_DISPLAY_CELLS:
        factor += 1
    return factor


def display_grid(grid: Grid, factor: int) -> Grid:
    """Coarser grid with the same top-left corner. It may reach a little past the grid's right and bottom edge."""
    t = grid.transform
    return Grid(
        crs=grid.crs,
        transform=Affine(t.a * factor, 0, t.c, 0, t.e * factor, t.f),
        width=math.ceil(grid.width / factor),
        height=math.ceil(grid.height / factor),
    )


def map_grid(grid: Grid, factor: int) -> dict:
    """The map_grid section of result.json for the display grid."""
    coarse = display_grid(grid, factor)
    return {
        "columns": coarse.width,
        "rows": coarse.height,
        "cell_size_m": CELL_M * factor,
        "corners_lonlat": coarse.corners_lonlat(),
    }


def coarsen(layer: np.ndarray, factor: int, how: str, keep: np.ndarray | None = None) -> np.ndarray:
    """Merge factor x factor blocks of a (rows, cols) layer into one value each (NaN = no value).

    ``keep`` (blocks shape, see _blocks) limits each block to some of its grid cells.
    """
    blocks = _blocks(np.asarray(layer, dtype=np.float32), factor)
    if keep is not None:
        blocks = np.where(keep, blocks, np.nan)
    valid = np.isfinite(blocks)
    enough = valid.sum(axis=-1) >= MIN_VALID_SHARE * factor * factor
    if how == MEDIAN:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", RuntimeWarning)  # all-NaN blocks give NaN, which is what we want
            merged = np.nanmedian(blocks, axis=-1)
    elif how == MODE:
        merged = _mode(blocks, valid)
    else:
        raise ValueError(f"unknown merge: {how}")
    return np.where(enough, merged, np.nan).astype(np.float32)


def cells_json(layers: Mapping[tuple[str, str], np.ndarray], factor: int) -> dict:
    """cells.json content from 30 m layers keyed by (group, name), e.g. ("model", "stage").

    Only the layers given are written, so a fire without a layer (say, no per-cell recovery) simply lacks that key.
    """
    unknown = [key for key in layers if key not in CELL_LAYERS]
    if unknown:
        raise KeyError(f"unknown cells.json layers: {unknown}")
    keep = _majority_zone_cells(layers[ZONE_LAYER], factor) if ZONE_LAYER in layers else None
    out: dict[str, dict[str, list]] = {}
    for key, layer in layers.items():
        how, multiplier = CELL_LAYERS[key]
        merged = coarsen(layer, factor, how, keep=None if key == ZONE_LAYER else keep)
        group, name = key
        out.setdefault(group, {})[name] = _to_json_list(merged * multiplier)
    return out


def write_fire(
    out_dir: Path | str,
    result: dict,
    cells: dict,
    optical_png: bytes | None = None,
) -> Path:
    """Write result.json, cells.json and optical.png (if given) to <out_dir>/<fire id>/. Returns that folder."""
    missing = [section for section in RESULT_SECTIONS if section not in result]
    if missing:
        raise ValueError(f"result is missing sections: {', '.join(missing)}")
    expected = result["map_grid"]["columns"] * result["map_grid"]["rows"]
    for group, layers in cells.items():
        for name, values in layers.items():
            if len(values) != expected:
                raise ValueError(f"cells.{group}.{name} has {len(values)} values, map_grid needs {expected}")

    folder = Path(out_dir) / result["fire"]["id"]
    folder.mkdir(parents=True, exist_ok=True)
    files = {"cells": "cells.json", "optical_image": "optical.png" if optical_png is not None else None}
    full = {"schema_version": SCHEMA_VERSION, **result, "files": files}
    _write_json(folder / "result.json", full, indent=2)
    _write_json(folder / "cells.json", cells)
    if optical_png is not None:
        (folder / "optical.png").write_bytes(optical_png)
    return folder


def update_index(out_dir: Path | str, result: dict) -> list[dict]:
    """Add or replace this fire in <out_dir>/index.json. Returns the new index.

    The file is replaced in one step, so a reader never sees half a file. Two runs
    finishing at the same moment can still lose one entry: one writer at a time is assumed.
    """
    path = Path(out_dir) / "index.json"
    index = json.loads(path.read_text(encoding="utf-8")) if path.exists() else []
    entry = index_entry(result)
    index = [e for e in index if e["id"] != entry["id"]] + [entry]
    index.sort(key=lambda e: e["id"])
    _write_json(path, index, indent=2)
    return index


def index_entry(result: dict) -> dict:
    """One index.json entry, taken from the fire's result."""
    fire = result["fire"]
    model = result.get("model_result") or {}
    forecast = result.get("growth_forecast") or {}
    centre = shape(fire["perimeter"]).centroid
    return {
        "id": fire["id"],
        "name": fire["name"],
        "year": fire["year"],
        "area_ha": fire["area_ha"],
        "summer": result["satellite_images"]["summer"],
        "center_lonlat": [round(centre.x, 4), round(centre.y, 4)],
        "recovery_today_avg": model.get("recovery_today_avg"),
        "area_recovered_80pct": model.get("area_recovered_80pct"),
        "year_80pct": forecast.get("year_80pct"),
        "result": f"{fire['id']}/result.json",
    }


def _blocks(layer: np.ndarray, factor: int) -> np.ndarray:
    """(rows, cols) -> (rows/f, cols/f, f*f), padding the right and bottom edge with NaN."""
    h, w = layer.shape
    H, W = math.ceil(h / factor), math.ceil(w / factor)
    padded = np.full((H * factor, W * factor), np.nan, dtype=np.float32)
    padded[:h, :w] = layer
    return padded.reshape(H, factor, W, factor).transpose(0, 2, 1, 3).reshape(H, W, factor * factor)


def _mode(blocks: np.ndarray, valid: np.ndarray) -> np.ndarray:
    """Most common value per block, ignoring NaN. Ties go to the smaller value."""
    categories = np.unique(blocks[valid])
    if not categories.size:
        return np.full(blocks.shape[:2], np.nan, dtype=np.float32)
    counts = np.stack([(blocks == c).sum(axis=-1) for c in categories], axis=-1)
    merged = categories[counts.argmax(axis=-1)].astype(np.float32)
    merged[counts.max(axis=-1) == 0] = np.nan
    return merged


def _to_json_list(values: np.ndarray) -> list[int | None]:
    """Row-major flat list, NaN -> None, numbers rounded to integers (index = row * columns + col)."""
    flat = values.ravel()
    finite = np.isfinite(flat)
    rounded = np.where(finite, np.round(flat), 0).astype(np.int64)
    return [int(v) if ok else None for v, ok in zip(rounded.tolist(), finite.tolist())]


def _majority_zone_cells(zones: np.ndarray, factor: int) -> np.ndarray:
    """Blocks mask: grid cells that belong to their block's majority zone. Blocks with no zone keep every cell."""
    blocks = _blocks(np.asarray(zones, dtype=np.float32), factor)
    majority = _mode(blocks, np.isfinite(blocks))[..., None]
    return (blocks == majority) | np.isnan(majority)


def _write_json(path: Path, data: Any, indent: int | None = None) -> None:
    """UTF-8 JSON (names contain Cyrillic), written to a temporary file and then moved into place."""
    separators = None if indent else (",", ":")
    text = json.dumps(data, ensure_ascii=False, indent=indent, separators=separators)
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(text, encoding="utf-8")
    os.replace(tmp, path)
