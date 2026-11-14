"""Write result.json, cells.json and optical.png. Owner: Yaroslav.

Format: DELIVERABLES, tab 1. cells.json arrays have length rows*cols,
index = row*cols + col, null = no value.
"""

from __future__ import annotations

from pathlib import Path


def write_result(out_dir: Path, **parts) -> None:
    raise NotImplementedError
