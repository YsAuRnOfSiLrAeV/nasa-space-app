"""GEE modules without Earth Engine: tiling, zones and the reference height on synthetic layers."""

import numpy as np
import pytest
from shapely.geometry import box

from pipeline.gee import client, gedi
from pipeline.gee.layers import BURNED, LOGGED, WORLDCOVER
from pipeline.gee.zones import BURN, REFERENCE, cells_within, fire_on_grid, make_zones
from pipeline.grid import make_grid

# About 5.6 x 5.6 km near Kamloops, British Columbia.
FIRE = box(-120.24, 51.12, -120.16, 51.17)


@pytest.fixture(scope="module")
def grid():
    return make_grid(FIRE)


@pytest.fixture(scope="module")
def scene(grid):
    """Forest everywhere, with a lake east of the fire, a clearcut west and an older burn north."""
    x, y = grid.cell_centers()
    fx, fy = fire_on_grid(FIRE, grid).centroid.coords[0]
    lake = (x - (fx + 6500)) ** 2 + (y - fy) ** 2 < 1200**2
    clearcut = (abs(x - (fx - 6500)) < 1000) & (abs(y - fy) < 2500)
    old_burn = (abs(x - fx) < 2500) & (abs(y - (fy + 6500)) < 1000)
    masks = {
        WORLDCOVER: np.where(lake, 80.0, 10.0),
        LOGGED: clearcut.astype(float),
        BURNED: old_burn.astype(float),
    }
    return masks, lake | clearcut | old_burn


def test_zones(grid, scene):
    masks, disturbed = scene
    zones = make_zones(FIRE, grid, masks)
    burn = cells_within(fire_on_grid(FIRE, grid), grid)

    assert zones.shape == grid.shape
    assert (zones[burn] == BURN).all()
    assert np.isnan(zones[disturbed & ~burn]).all()
    assert (zones[~burn & ~disturbed] == REFERENCE).all()
    assert burn.sum() * 30 * 30 == pytest.approx(fire_on_grid(FIRE, grid).area, rel=0.01)


def test_zones_accept_geojson(grid, scene):
    masks, _ = scene
    assert np.array_equal(make_zones(FIRE.__geo_interface__, grid, masks), make_zones(FIRE, grid, masks), equal_nan=True)


def test_missing_land_cover_is_not_reference(grid, scene):
    masks, _ = scene
    zones = make_zones(FIRE, grid, {**masks, WORLDCOVER: np.full(grid.shape, np.nan)})
    assert not (zones == REFERENCE).any()


def sparse_shots(grid, zones, step):
    """A shot every `step` cells: 20 m in reference forest, 3 m anywhere else."""
    rows, cols = np.indices(grid.shape)
    height = np.where(zones == REFERENCE, 20.0, 3.0)
    return np.where((rows % step == 0) & (cols % step == 0), height, np.nan)


def test_reference_height_from_gedi(grid, scene, monkeypatch):
    zones = make_zones(FIRE, grid, scene[0])
    monkeypatch.setattr(gedi, "_gedi_rh98", lambda g: sparse_shots(g, zones, step=5))

    result = gedi.reference_height(FIRE, grid, zones)

    assert result["source"] == "gedi" and result["height_m"] == 20.0
    assert result["shots"] >= gedi.MIN_SHOTS


def test_reference_height_uses_only_the_ring(grid, scene, monkeypatch):
    zones = make_zones(FIRE, grid, scene[0])
    fire = fire_on_grid(FIRE, grid)
    near = cells_within(fire.buffer(gedi.RING_INNER_M), grid)
    far = ~cells_within(fire.buffer(gedi.RING_OUTER_M), grid)
    shots = sparse_shots(grid, zones, step=5)
    shots[(near | far) & np.isfinite(shots)] = 99.0  # must not be counted
    monkeypatch.setattr(gedi, "_gedi_rh98", lambda g: shots)

    assert gedi.reference_height(FIRE, grid, zones)["height_m"] == 20.0


def test_reference_height_falls_back_to_eth(grid, scene, monkeypatch):
    zones = make_zones(FIRE, grid, scene[0])
    monkeypatch.setattr(gedi, "_gedi_rh98", lambda g: sparse_shots(g, zones, step=200))  # too few shots
    monkeypatch.setattr(gedi, "_eth_height", lambda g: np.full(g.shape, 17.0))

    result = gedi.reference_height(FIRE, grid, zones)

    assert result["source"] == "eth" and result["height_m"] == 17.0
    assert result["shots"] < gedi.MIN_SHOTS


def test_reference_height_north_of_gedi_coverage(monkeypatch):
    fire = box(-112.0, 57.0, -111.9, 57.05)
    grid = make_grid(fire)
    forest = {WORLDCOVER: np.full(grid.shape, 10.0), LOGGED: np.zeros(grid.shape), BURNED: np.zeros(grid.shape)}
    zones = make_zones(fire, grid, forest)
    monkeypatch.setattr(gedi, "_gedi_rh98", lambda g: pytest.fail("GEDI has no data this far north"))
    monkeypatch.setattr(gedi, "_eth_height", lambda g: np.full(g.shape, 12.0))

    assert gedi.reference_height(fire, grid, zones) == {"height_m": 12.0, "source": "eth", "shots": 0}


def test_reference_height_needs_reference_forest(grid):
    with pytest.raises(ValueError, match="no reference forest"):
        gedi.reference_height(FIRE, grid, np.full(grid.shape, np.nan))


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
        col, row = round((t["translateX"] - left) / 30), round((top - t["translateY"]) / 30)
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
