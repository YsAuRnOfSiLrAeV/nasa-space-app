"""Earth Engine session and computePixels on the shared grid."""

from __future__ import annotations

import os
from functools import lru_cache

import numpy as np

from ..grid import Grid

# computePixels returns masked pixels as 0, which looks like data.
# Every band is unmasked to NODATA on the server and turned into NaN here.
NODATA = -9999
# Cells per side of one request, to stay under the computePixels response limit.
TILE = 1024


@lru_cache(maxsize=1)
def session():
    """Initialised ``ee`` module. Needs GEE_PROJECT and `earthengine authenticate` (see README)."""
    import ee
    from dotenv import load_dotenv

    load_dotenv()
    ee.Initialize(project=os.environ["GEE_PROJECT"])
    return ee


def fetch(image, grid: Grid, bands: list[str]) -> dict[str, np.ndarray]:
    """Compute ``bands`` of an ee.Image on ``grid``: {band: (rows, cols) float32 array, NaN = no value}."""
    ee = session()
    image = image.select(bands).toFloat().unmask(NODATA)
    layers = {band: grid.empty() for band in bands}
    full = grid.to_ee()
    t = full["affineTransform"]
    for row in range(0, grid.height, TILE):
        for col in range(0, grid.width, TILE):
            height = min(TILE, grid.height - row)
            width = min(TILE, grid.width - col)
            window = {
                **full,
                "dimensions": {"width": width, "height": height},
                "affineTransform": {
                    **t,
                    "translateX": t["translateX"] + col * t["scaleX"],
                    "translateY": t["translateY"] + row * t["scaleY"],
                },
            }
            tile = ee.data.computePixels({"expression": image, "fileFormat": "NUMPY_NDARRAY", "grid": window})
            for band in bands:
                layers[band][row : row + height, col : col + width] = tile[band]
    for layer in layers.values():
        layer[layer == NODATA] = np.nan
    return layers
