"""Inputs of the state model, one row per grid cell, and its output put back on the grid.

The state model gives the forest height stage of each cell (under 5 m, 5-10 m,
over 10 m) from five values of that cell: NISAR HV and HH, Sentinel-1 VH and VV,
and NDVI. The pipeline has them as five maps on the fire grid. ``build_table``
turns the maps into rows, one per cell, with the values in the order the model
was trained on. Cells missing any of the five values are skipped. The model
returns one value per row, and ``CellTable.to_grid`` puts each value back into
its cell, so the result is a map again.

``input_report`` compares the five values with the ranges seen in training. If
the model output looks wrong, this shows whether the inputs are the cause.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Mapping

import numpy as np

from .contract import FEATURE_COLUMNS

# State model input order, as defined in the contract.
FEATURES = tuple(FEATURE_COLUMNS)


@dataclass(frozen=True)
class CellTable:
    """State model inputs: one row per cell that has all five values, and where each row came from."""
    names: tuple[str, ...]
    values: np.ndarray        # (n, len(names)) float32
    rows: np.ndarray          # (n,) grid row of each table row
    cols: np.ndarray          # (n,) grid column of each table row
    shape: tuple[int, int]    # grid shape, to put results back

    def __len__(self) -> int:
        return len(self.values)

    def column(self, name: str) -> np.ndarray:
        return self.values[:, self.names.index(name)]

    def to_grid(self, values: np.ndarray) -> np.ndarray:
        """One value per table row -> (rows, cols) float32 array, NaN for cells not in the table."""
        values = np.asarray(values)
        if values.shape != (len(self),):
            raise ValueError(f"expected {len(self)} values, got shape {values.shape}")
        out = np.full(self.shape, np.nan, dtype=np.float32)
        out[self.rows, self.cols] = values
        return out


def build_table(
    layers: Mapping[str, np.ndarray],
    where: np.ndarray | None = None,
    features: tuple[str, ...] = FEATURES,
) -> CellTable:
    """Table of ``features`` for cells where ``where`` is True (all cells by default) and no feature is NaN."""
    missing = [name for name in features if name not in layers]
    if missing:
        raise KeyError(f"missing layers: {', '.join(missing)}")
    shape = layers[features[0]].shape
    wrong = [name for name in features if layers[name].shape != shape]
    if wrong:
        raise ValueError(f"layers not on the same grid as {features[0]}: {', '.join(wrong)}")

    stack = np.stack([np.asarray(layers[name], dtype=np.float32) for name in features], axis=-1)
    keep = np.isfinite(stack).all(axis=-1)
    if where is not None:
        keep &= where
    rows, cols = np.nonzero(keep)
    return CellTable(tuple(features), stack[rows, cols], rows, cols, shape)


def input_report(table: CellTable, ranges: Mapping[str, tuple[float, float]]) -> dict[str, dict]:
    """Per feature: median, 5th and 95th percentile, and the share of cells outside the training range.

    ``ranges`` maps feature name -> (low, high) seen in training. Features without a range get no share.
    """
    report = {}
    for name in table.names:
        x = table.column(name)
        entry = {"cells": len(x), "median": None, "p5": None, "p95": None, "outside_share": None}
        if len(x):
            p5, median, p95 = np.percentile(x, [5, 50, 95])
            entry.update(median=round(float(median), 3), p5=round(float(p5), 3), p95=round(float(p95), 3))
            if name in ranges:
                low, high = ranges[name]
                entry["outside_share"] = round(float(((x < low) | (x > high)).mean()), 4)
        report[name] = entry
    return report
