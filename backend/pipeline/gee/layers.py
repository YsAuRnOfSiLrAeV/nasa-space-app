"""GEE layers on the shared grid via ee.data.computePixels. Owner: Misha.

- Sentinel-1 GRD, IW, ascending, Jul 10-25, median, focalMean 30 m -> s1_VH, s1_VV (dB)
- Sentinel-2 SR Harmonized, Jul 1 - Aug 15, cloud < 20%, median, (B8-B4)/(B8+B4) -> NDVI (0..1)
- WorldCover (water / forest mask), Hansen (forest loss), MODIS (fire history)

Only month/day are fixed, the year is a parameter.
TODO: take the windows from forestrecovery.feature_spec() once it is implemented.
"""

from __future__ import annotations

from ..contract import NDVI, S1_VH, S1_VV
from ..grid import Grid
from . import client

# (first day, day after the last one): filterDate excludes its end.
S1_WINDOW = ("07-10", "07-26")
S2_WINDOW = ("07-01", "08-16")
S2_MAX_CLOUD_PCT = 20
S1_SMOOTH_M = 30

# Mask layer names, read by zones.py.
WORLDCOVER = "worldcover"  # ESA class: 10 trees, 80 water
LOGGED = "logged"  # 1 where Hansen recorded forest loss
BURNED = "burned"  # 1 where MODIS recorded a fire since 2001

HANSEN = "UMD/hansen/global_forest_change_2024_v1_12"
MODIS_FIRST_YEAR = 2001


def sentinel1(grid: Grid, year: int) -> dict:
    """Return {"s1_VH": array, "s1_VV": array} in dB on `grid`."""
    ee = client.session()
    scenes = (
        ee.ImageCollection("COPERNICUS/S1_GRD")
        .filterBounds(_region(ee, grid))
        .filterDate(*_dates(year, S1_WINDOW))
        .filter(ee.Filter.eq("instrumentMode", "IW"))
        .filter(ee.Filter.eq("orbitProperties_pass", "ASCENDING"))
        .filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VH"))
    )
    image = scenes.select(["VH", "VV"]).median().focalMean(S1_SMOOTH_M, "circle", "meters").rename([S1_VH, S1_VV])
    return client.fetch(image, grid, [S1_VH, S1_VV])


def ndvi(grid: Grid, year: int) -> dict:
    """Return {"NDVI": array} in 0..1 on `grid`."""
    ee = client.session()
    scenes = (
        ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
        .filterBounds(_region(ee, grid))
        .filterDate(*_dates(year, S2_WINDOW))
        .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", S2_MAX_CLOUD_PCT))
    )
    image = scenes.median().normalizedDifference(["B8", "B4"]).rename(NDVI)
    return client.fetch(image, grid, [NDVI])


def masks(grid: Grid, year: int) -> dict:
    """Return WorldCover / Hansen / MODIS layers on `grid` (used by zones.py)."""
    ee = client.session()
    worldcover = ee.ImageCollection("ESA/WorldCover/v200").first().rename(WORLDCOVER)
    logged = ee.Image(HANSEN).select("lossyear").gt(0).unmask(0).rename(LOGGED)
    burned = (
        ee.ImageCollection("MODIS/061/MCD64A1")
        .filterDate(f"{MODIS_FIRST_YEAR}-01-01", f"{year + 1}-01-01")
        .select("BurnDate")
        .max()
        .gt(0)
        .unmask(0)
        .rename(BURNED)
    )
    image = worldcover.addBands(logged).addBands(burned)
    return client.fetch(image, grid, [WORLDCOVER, LOGGED, BURNED])


def _dates(year: int, window: tuple[str, str]) -> tuple[str, str]:
    return f"{year}-{window[0]}", f"{year}-{window[1]}"


def _region(ee, grid: Grid):
    """Grid rectangle, to keep only the scenes that touch it."""
    return ee.Geometry.Rectangle(list(grid.bounds), grid.crs, False)
