"""GEE layers on the shared grid via ee.data.computePixels.

- Sentinel-1 GRD, IW, ascending, Jul 10-24, median, focalMean 30 m -> s1_VH, s1_VV (dB)
- Sentinel-2 SR Harmonized, Jul 1 - Aug 14, cloud < 20%, median, (B8-B4)/(B8+B4) -> NDVI
- WorldCover (water / forest mask), Hansen (forest loss), MODIS + NBAC (fire history)

Only month/day are fixed, the year is a parameter.
TODO: take the windows from forestrecovery.feature_spec() once it is implemented.
"""

from __future__ import annotations

from ..contract import NDVI, S1_VH, S1_VV
from ..grid import Grid
from . import client

# (first day, last day), both included.
S1_WINDOW = ("07-10", "07-24")  # training: filterDate 07-10 .. 07-25, end excluded
S2_WINDOW = ("07-01", "08-14")  # training: filterDate 07-01 .. 08-15, end excluded
S2_MAX_CLOUD_PCT = 20
S1_SMOOTH_M = 30
# The focal mean must run on Sentinel-1's own 10 m pixels, not on the 30 m grid cells.
# TODO: confirm against the training scripts that this is the scale the features were smoothed at.
S1_PIXEL_M = 10

# Mask layer names, read by zones.py.
WORLDCOVER = "worldcover"  # ESA class: 10 trees, 80 water
FOREST_LOSS = "forest_loss"  # 1 where Hansen recorded any forest loss (logging, fire, ...)
BURNED = "burned"  # 1 inside a known fire: MODIS since 2001 or an NBAC perimeter since 1972

HANSEN = "UMD/hansen/global_forest_change_2025_v1_13"
NBAC = "projects/sat-io/open-datasets/CA_FOREST/NBAC/nbac_1972_2023_20240530"
MODIS_FIRST_YEAR = 2001


class NoScenesError(ValueError):
    """No satellite scenes over the grid in the date window."""


def sentinel1(grid: Grid, year: int) -> dict:
    """Return {"s1_VH": array, "s1_VV": array} in dB on `grid`."""
    scenes = _s1_scenes(grid, year)
    _require(scenes, "Sentinel-1", year, S1_WINDOW)
    image = (
        scenes.select(["VH", "VV"])
        .median()
        .focalMean(S1_SMOOTH_M, "square", "meters")  # square kernel, as in the training scripts
        .reproject(crs=grid.crs, scale=S1_PIXEL_M)
        .rename([S1_VH, S1_VV])
    )
    return client.fetch(image, grid, [S1_VH, S1_VV])


def ndvi(grid: Grid, year: int) -> dict:
    """Return {"NDVI": array} on `grid`: a ratio in -1..1 (vegetation 0..1), not scaled by 10000."""
    scenes = _s2_scenes(grid, year)
    _require(scenes, "Sentinel-2", year, S2_WINDOW)
    image = scenes.median().normalizedDifference(["B8", "B4"]).rename(NDVI)
    return client.fetch(image, grid, [NDVI])


def masks(grid: Grid, year: int) -> dict:
    """Return WorldCover / Hansen / fire history layers on `grid` (used by zones.py)."""
    ee = client.session()
    worldcover = ee.ImageCollection("ESA/WorldCover/v200").first().rename(WORLDCOVER)
    forest_loss = ee.Image(HANSEN).select("lossyear").gt(0).unmask(0).rename(FOREST_LOSS)
    modis = (
        ee.ImageCollection("MODIS/061/MCD64A1")
        .filterDate(f"{MODIS_FIRST_YEAR}-01-01", f"{year + 1}-01-01")
        .select("BurnDate")
        .max()
        .gt(0)
        .unmask(0)
    )
    # MODIS starts in 2001; NBAC perimeters add the fires of 1972-2000, whose forest is still young.
    nbac = ee.Image(0).paint(ee.FeatureCollection(NBAC).filterBounds(client.region(grid)), 1)
    burned = modis.Or(nbac).rename(BURNED)
    image = worldcover.addBands(forest_loss).addBands(burned)
    return client.fetch(image, grid, [WORLDCOVER, FOREST_LOSS, BURNED])


def satellite_images(grid: Grid, year: int) -> dict:
    """Return the sentinel1 / sentinel2 blocks of `satellite_images` in result.json."""
    s1_from, s1_to = _dates(year, S1_WINDOW)
    s2_from, s2_to = _dates(year, S2_WINDOW)
    return {
        "sentinel1": {"from": s1_from, "to": s1_to, "scenes": _s1_scenes(grid, year).size().getInfo()},
        "sentinel2": {"from": s2_from, "to": s2_to, "scenes": _s2_scenes(grid, year).size().getInfo()},
    }


def _s1_scenes(grid: Grid, year: int):
    ee = client.session()
    return (
        ee.ImageCollection("COPERNICUS/S1_GRD")
        .filterBounds(client.region(grid))
        .filterDate(*_date_filter(ee, year, S1_WINDOW))
        .filter(ee.Filter.eq("instrumentMode", "IW"))
        .filter(ee.Filter.eq("orbitProperties_pass", "ASCENDING"))
        .filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VH"))
    )


def _s2_scenes(grid: Grid, year: int):
    ee = client.session()
    return (
        ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
        .filterBounds(client.region(grid))
        .filterDate(*_date_filter(ee, year, S2_WINDOW))
        .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", S2_MAX_CLOUD_PCT))
    )


def _require(scenes, satellite: str, year: int, window: tuple[str, str]) -> None:
    """Fail with a clear message instead of an Earth Engine error about missing bands."""
    if scenes.size().getInfo() == 0:
        first, last = _dates(year, window)
        raise NoScenesError(f"no {satellite} scenes over the fire between {first} and {last}")


def _dates(year: int, window: tuple[str, str]) -> tuple[str, str]:
    return f"{year}-{window[0]}", f"{year}-{window[1]}"


def _date_filter(ee, year: int, window: tuple[str, str]):
    """filterDate arguments: it excludes its end, so the last day is moved one day forward."""
    first, last = _dates(year, window)
    return first, ee.Date(last).advance(1, "day")
