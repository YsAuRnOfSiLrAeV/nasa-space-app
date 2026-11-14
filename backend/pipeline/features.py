"""Assemble the feature table from NISAR and GEE columns. Owner: Yaroslav."""

from __future__ import annotations

from .contract import FEATURE_COLUMNS


def build_table(*layer_dicts: dict) -> dict:
    """Merge {column: (rows, cols) array} dicts; check every FEATURE_COLUMNS entry is present
    and all arrays have the same shape."""
    raise NotImplementedError
