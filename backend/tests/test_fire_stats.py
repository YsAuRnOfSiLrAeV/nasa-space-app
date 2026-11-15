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


def test_warning_codes():
    codes = fire_stats.warnings({"slope": 8.0, "dnbr": None}, nisar_coverage=0.5)
    assert codes == ["DEFAULT_DNBR", "LOW_NISAR_COVERAGE"]
    assert fire_stats.warnings({"slope": 8.0}, nisar_coverage=0.99) == []
