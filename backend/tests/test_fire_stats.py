"""Per-fire numbers (forecast inputs and result totals) on synthetic maps."""
import math

import numpy as np
import pytest
from shapely.geometry import box

from pipeline import fire_stats
from pipeline.contract import ZONE_BURN, ZONE_REFERENCE
from pipeline.grid import CELL_M, make_grid

FIRE = box(-120.24, 51.12, -120.16, 51.17)  # about 5.6 x 5.6 km near Kamloops, British Columbia


@pytest.fixture(scope="module")
def grid():
    return make_grid(FIRE)


@pytest.fixture(scope="module")
def inside(grid):
    return fire_stats.fire_mask(FIRE, grid)


@pytest.fixture(scope="module")
def zones(grid, inside):
    """Burn inside the fire, reference everywhere else."""
    return np.where(inside, ZONE_BURN, ZONE_REFERENCE).astype(np.float32)


def test_fire_mask_matches_the_fire_area(grid, inside):
    assert inside.sum() * CELL_M**2 == pytest.approx(grid.to_grid_crs(FIRE).area, rel=0.01)


def test_distance_to_edge(inside):
    d = fire_stats.distance_to_edge(inside)
    assert np.isnan(d[~inside]).all()
    assert np.nanmin(d) == CELL_M                      # border cells are one cell from outside
    half_width = np.sqrt(inside.sum()) * CELL_M / 2    # the fire is close to a square
    assert np.nanmax(d) == pytest.approx(half_width, rel=0.15)


def test_covariates_are_burn_medians_and_missing_ones_are_none(grid, zones):
    slope = np.where(zones == ZONE_BURN, 8.0, 30.0)
    elev = np.full(grid.shape, np.nan)
    result = fire_stats.covariates({"slope": slope, "elev": elev}, zones)
    assert result["slope"] == 8.0
    assert result["elev"] is None
    assert result["dnbr"] is None
    assert set(result) == set(fire_stats.GRID_COVARIATES)


def test_fire_size_log():
    assert fire_stats.fire_size_log(27137) == pytest.approx(math.log10(27137), abs=1e-4)


def test_stage_share_counts_only_burn_cells(zones):
    stage = np.where(zones == ZONE_BURN, 1.0, 2.0)
    stage[np.nonzero(zones == ZONE_BURN)[0][0], np.nonzero(zones == ZONE_BURN)[1][0]] = np.nan
    assert fire_stats.stage_share(stage, zones) == [0.0, 1.0, 0.0]


def test_coverage(zones):
    layer = np.where(zones == ZONE_BURN, 1.0, np.nan)
    burn_rows, burn_cols = np.nonzero(zones == ZONE_BURN)
    half = len(burn_rows) // 2
    layer[burn_rows[:half], burn_cols[:half]] = np.nan
    assert fire_stats.coverage(layer, zones) == pytest.approx(0.5, abs=0.01)


def test_optics_recovery_is_burn_ndvi_over_reference_ndvi(zones):
    ndvi = np.where(zones == ZONE_BURN, 0.72, 0.80)
    assert fire_stats.optics_recovery(ndvi, zones) == pytest.approx(0.9)
    assert fire_stats.optics_recovery(np.full(zones.shape, np.nan), zones) is None


def test_lidar_in_burn_compares_mean_shot_height_with_the_neighbour_forest(grid, zones):
    heights = np.full(grid.shape, np.nan)
    rows, cols = np.nonzero(zones == ZONE_BURN)
    heights[rows[::50], cols[::50]] = 7.0              # sparse shots inside the burn
    heights[np.nonzero(zones == ZONE_REFERENCE)[0][:20], np.nonzero(zones == ZONE_REFERENCE)[1][:20]] = 30.0  # not counted
    result = fire_stats.lidar_in_burn(heights, zones, grid, reference_height_m=17.5)

    assert result["lidar"] == pytest.approx(0.4)
    assert result["points_in_fire"] == len(rows[::50])
    assert len(result["points"]) == min(result["points_in_fire"], fire_stats.MAX_LIDAR_POINTS)
    lon_min, lat_min, lon_max, lat_max = FIRE.bounds
    assert all(lon_min <= p["lon"] <= lon_max and lat_min <= p["lat"] <= lat_max for p in result["points"])
    assert {p["height_m"] for p in result["points"]} == {7.0}


def test_too_few_shots_give_no_lidar_value(grid, zones):
    heights = np.full(grid.shape, np.nan)
    rows, cols = np.nonzero(zones == ZONE_BURN)
    heights[rows[:3], cols[:3]] = 7.0
    result = fire_stats.lidar_in_burn(heights, zones, grid, reference_height_m=17.5)
    assert result["lidar"] is None and result["points_in_fire"] == 3 and len(result["points"]) == 3


def test_no_gedi_north_of_coverage(grid, zones):
    assert fire_stats.lidar_in_burn(None, zones, grid, 17.5) == {"lidar": None, "points_in_fire": 0, "points": []}



def test_lidar_shot_mask_follows_the_training_label_rules():
    shape = (1, 8)
    layers = {
        "slope": np.full(shape, 4.0),
        "edge_m": np.full(shape, 500.0),
        "ndvi": np.full(shape, 0.7),
        "worldcover": np.full(shape, 10.0),
        "loss_year": np.zeros(shape),
        "last_fire": np.zeros(shape),
    }
    layers["slope"][0, 1] = 12.0          # steep
    layers["edge_m"][0, 2] = 60.0         # too close to the perimeter
    layers["ndvi"][0, 3] = 0.1            # bare
    layers["worldcover"][0, 4] = 40.0     # cropland
    layers["loss_year"][0, 5] = 15        # logged in 2015, long after the fire
    layers["loss_year"][0, 6] = 4         # loss in 2004 is the 2003 fire itself
    layers["last_fire"][0, 7] = 2017      # burned again

    usable = fire_stats.lidar_shot_mask(2003, **layers)

    assert usable[0].tolist() == [True, False, False, False, False, False, True, False]


def test_lidar_in_burn_uses_only_usable_shots(grid, zones):
    heights = np.full(grid.shape, np.nan)
    rows, cols = np.nonzero(zones == ZONE_BURN)
    heights[rows[::50], cols[::50]] = 7.0
    heights[rows[25::50], cols[25::50]] = 25.0     # shots on steep ground, too tall
    usable = np.ones(grid.shape, dtype=bool)
    usable[rows[25::50], cols[25::50]] = False

    result = fire_stats.lidar_in_burn(heights, zones, grid, reference_height_m=17.5, usable=usable)

    assert result["lidar"] == pytest.approx(0.4)
    assert result["points_in_fire"] == len(rows[::50])
