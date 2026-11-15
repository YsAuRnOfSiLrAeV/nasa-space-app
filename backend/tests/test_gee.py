"""GEE modules without Earth Engine: tiling, zones and the reference height on synthetic layers.

The last test talks to the real Earth Engine and is skipped unless GEE_PROJECT is set.
"""

import os

import numpy as np
import pytest
import shapely
from shapely.geometry import box

from pipeline.gee import client, gedi, layers
from pipeline.gee.layers import BURNED, FOREST_LOSS, WORLDCOVER
from pipeline.gee.zones import BURN, REFERENCE, RING_INNER_M, RING_OUTER_M, make_zones
from pipeline.grid import CELL_M, make_grid

# About 5.6 x 5.6 km near Kamloops, British Columbia.
FIRE = box(-120.24, 51.12, -120.16, 51.17)


@pytest.fixture(scope="module")
def grid():
    return make_grid(FIRE)


@pytest.fixture(scope="module")
def land(grid):
    """Where things are on the grid: the fire, distance bands around it and what disturbs the forest."""
    fire = grid.to_grid_crs(FIRE)
    x, y = grid.cell_centers()
    fx, fy = fire.centroid.coords[0]
    within = lambda area: shapely.contains_xy(area, x, y)  # noqa: E731
    return {
        "fire": within(fire),
        "ring": within(fire.buffer(RING_OUTER_M)) & ~within(fire.buffer(RING_INNER_M)),
        "lake_in_fire": (x - fx) ** 2 + (y - fy) ** 2 < 500**2,
        "lake": (x - (fx + 6500)) ** 2 + (y - fy) ** 2 < 1200**2,
        "clearcut": (abs(x - (fx - 6500)) < 1000) & (abs(y - fy) < 2500),
        "old_burn": (abs(x - fx) < 2500) & (abs(y - (fy + 6500)) < 1000),
    }


@pytest.fixture(scope="module")
def masks(land):
    """Forest everywhere, except two lakes, a clearcut and an older burn."""
    return {
        WORLDCOVER: np.where(land["lake"] | land["lake_in_fire"], 80.0, 10.0),
        FOREST_LOSS: land["clearcut"].astype(float),
        BURNED: land["old_burn"].astype(float),
    }


@pytest.fixture(scope="module")
def zones(grid, masks):
    return make_zones(FIRE, grid, masks)


def test_burn_is_the_fire_without_water(grid, zones, land):
    burn = land["fire"] & ~land["lake_in_fire"]
    assert zones.shape == grid.shape
    assert np.array_equal(zones == BURN, burn)
    assert np.isnan(zones[land["lake_in_fire"]]).all()


def test_reference_is_clean_forest_in_the_ring(zones, land):
    disturbed = land["lake"] | land["clearcut"] | land["old_burn"]
    assert np.array_equal(zones == REFERENCE, land["ring"] & ~disturbed)
    # every disturbance does reach into the ring, so the line above really tests the masks
    for name in ("lake", "clearcut", "old_burn"):
        assert (land[name] & land["ring"]).any(), name


def test_cells_next_to_the_fire_and_beyond_the_ring_are_excluded(zones, land):
    outside_fire_and_ring = ~land["fire"] & ~land["ring"]
    assert outside_fire_and_ring.any()
    assert np.isnan(zones[outside_fire_and_ring]).all()


def test_zones_accept_geojson(grid, masks, zones):
    assert np.array_equal(make_zones(FIRE.__geo_interface__, grid, masks), zones, equal_nan=True)


def test_missing_land_cover_is_not_reference(grid, masks):
    zones = make_zones(FIRE, grid, {**masks, WORLDCOVER: np.full(grid.shape, np.nan)})
    assert not (zones == REFERENCE).any()


def shots_every(grid, zones, step):
    """A shot every `step` cells: 20 m in reference forest, 3 m anywhere else."""
    rows, cols = np.indices(grid.shape)
    height = np.where(zones == REFERENCE, 20.0, 3.0)
    return np.where((rows % step == 0) & (cols % step == 0), height, np.nan)


def test_reference_height_from_gedi(grid, zones, monkeypatch):
    monkeypatch.setattr(gedi, "_gedi_rh98", lambda g: shots_every(g, zones, step=5))

    result = gedi.reference_height(FIRE, grid, zones)

    # the 3 m shots on the burn, lakes, clearcut and old burn must not leak in
    assert result["source"] == "gedi" and result["height_m"] == 20.0
    assert result["shots"] >= gedi.MIN_SHOTS


def test_reference_height_falls_back_to_eth(grid, zones, monkeypatch):
    monkeypatch.setattr(gedi, "_gedi_rh98", lambda g: shots_every(g, zones, step=200))  # too few shots
    monkeypatch.setattr(gedi, "_eth_height", lambda g: np.full(g.shape, 17.0))

    result = gedi.reference_height(FIRE, grid, zones)

    assert result["source"] == "eth" and result["height_m"] == 17.0
    assert result["shots"] < gedi.MIN_SHOTS


def test_reference_height_north_of_gedi_coverage(monkeypatch):
    fire = box(-112.0, 57.0, -111.9, 57.05)
    grid = make_grid(fire)
    forest = {WORLDCOVER: np.full(grid.shape, 10.0), FOREST_LOSS: np.zeros(grid.shape), BURNED: np.zeros(grid.shape)}
    zones = make_zones(fire, grid, forest)
    monkeypatch.setattr(gedi, "_gedi_rh98", lambda g: pytest.fail("GEDI has no data this far north"))
    monkeypatch.setattr(gedi, "_eth_height", lambda g: np.full(g.shape, 12.0))

    assert gedi.reference_height(fire, grid, zones) == {"height_m": 12.0, "source": "eth", "shots": 0}


def test_reference_height_needs_reference_forest(grid):
    with pytest.raises(ValueError, match="no reference forest"):
        gedi.reference_height(FIRE, grid, np.full(grid.shape, np.nan))


def test_reference_height_fails_when_no_source_has_data(grid, zones, monkeypatch):
    monkeypatch.setattr(gedi, "_gedi_rh98", lambda g: np.full(g.shape, np.nan))
    monkeypatch.setattr(gedi, "_eth_height", lambda g: np.full(g.shape, np.nan))

    with pytest.raises(ValueError, match="no canopy height"):
        gedi.reference_height(FIRE, grid, zones)


class FakeScenes:
    def __init__(self, count):
        self.count = count

    def size(self):
        return self

    def getInfo(self):
        return self.count


def test_no_scenes_is_a_clear_error():
    layers._require(FakeScenes(3), "Sentinel-1", 2026, layers.S1_WINDOW)
    with pytest.raises(layers.NoScenesError, match="no Sentinel-1 scenes over the fire between 2026-07-10 and 2026-07-24"):
        layers._require(FakeScenes(0), "Sentinel-1", 2026, layers.S1_WINDOW)


def test_missing_project_points_to_the_readme(monkeypatch):
    monkeypatch.setitem(__import__("sys").modules, "ee", object())
    monkeypatch.setattr("dotenv.load_dotenv", lambda: None)
    monkeypatch.delenv("GEE_PROJECT", raising=False)
    client.session.cache_clear()

    with pytest.raises(RuntimeError, match="GEE_PROJECT is not set.*README"):
        client.session()
    client.session.cache_clear()


class FakeImage:
    """Stands in for ee.Image: fetch only prepares it and hands it to computePixels."""

    def select(self, _bands):
        return self

    def toFloat(self):
        return self

    def unmask(self, _value):
        return self


def test_fetch_stitches_tiles_and_marks_nodata(grid, monkeypatch):
    monkeypatch.setattr(client, "TILE", 256)
    left, _bottom, _right, top = grid.bounds
    requests = []

    def compute_pixels(params):
        t, size = params["grid"]["affineTransform"], params["grid"]["dimensions"]
        col, row = round((t["translateX"] - left) / CELL_M), round((top - t["translateY"]) / CELL_M)
        requests.append((row, col))
        rows, cols = np.indices((size["height"], size["width"]))
        tile = np.zeros((size["height"], size["width"]), dtype=[("a", "f4")])
        tile["a"] = (rows + row) * 10_000 + cols + col  # each cell gets its own grid position
        tile["a"][(rows + row == 3) & (cols + col == 5)] = client.NODATA
        return tile

    class FakeEE:
        class data:
            computePixels = staticmethod(compute_pixels)

    monkeypatch.setattr(client, "session", lambda: FakeEE)

    layer = client.fetch(FakeImage(), grid, ["a"])["a"]

    assert len(requests) == -(-grid.height // 256) * -(-grid.width // 256)
    rows, cols = np.indices(grid.shape)
    expected = (rows * 10_000 + cols).astype(np.float32)
    assert np.isnan(layer[3, 5])
    layer[3, 5] = expected[3, 5]
    assert np.array_equal(layer, expected)


@pytest.mark.skipif(not os.environ.get("GEE_PROJECT"), reason="needs Earth Engine access (GEE_PROJECT)")
def test_earth_engine_pixels_land_on_grid_cells(grid):
    """Ask Earth Engine where it thinks each cell is and compare with the grid."""
    ee = client.session()
    where = client.fetch(ee.Image.pixelCoordinates(grid.crs), grid, ["x", "y"])
    x, y = grid.cell_centers()

    # within half a cell whichever corner or centre Earth Engine reports; a shifted or flipped grid fails
    assert np.abs(where["x"] - x).max() <= CELL_M / 2
    assert np.abs(where["y"] - y).max() <= CELL_M / 2


def test_reference_height_uses_given_shots_without_downloading(grid, zones, monkeypatch):
    monkeypatch.setattr(gedi, "_gedi_rh98", lambda g: pytest.fail("shots were given, nothing to download"))
    heights = np.where(zones == REFERENCE, 20.0, np.nan)
    assert gedi.reference_height(FIRE, grid, zones, heights=heights)["height_m"] == 20.0



def test_shots_after_fire(grid, monkeypatch):
    starts = []
    monkeypatch.setattr(gedi, "_gedi_rh98", lambda g, start: starts.append(start) or np.zeros(g.shape))
    every = np.ones(grid.shape)
    assert gedi.shots_after_fire(FIRE, grid, 2010, every) is every       # all shots already after the fire
    assert gedi.shots_after_fire(FIRE, grid, 2010, None) is None          # north of GEDI coverage
    gedi.shots_after_fire(FIRE, grid, 2020, every)
    assert starts == ["2021-01-01"]
    assert np.isnan(gedi.shots_after_fire(FIRE, grid, 2023, every)).all()  # GEDI ended in March 2023
