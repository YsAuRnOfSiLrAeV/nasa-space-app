"""NISAR module on synthetic GCOV granules: no network, files are written with h5py."""
from datetime import date

import h5py
import numpy as np
import pytest
from shapely.geometry import box

from pipeline import nisar
from pipeline.contract import NISAR_HH, NISAR_HV
from pipeline.grid import make_grid

FIRE = box(-120.24, 51.12, -120.16, 51.17)  # about 5.6 x 5.6 km near Kamloops, British Columbia
PIXEL_M = 20.0                               # GCOV pixel spacing used in the synthetic granules


@pytest.fixture(scope="module")
def grid():
    return make_grid(FIRE)


def name(day: str, direction: str = "A") -> str:
    """Granule name with the pass at position 6 and the start time, like real GCOV names."""
    return f"NISAR_L2_PR_GCOV_001_005_{direction}_150_4005_DHDH_A_{day}T120000_{day}T120015_X05007_N_F_J_001"


def write_granule(path, grid, hh, hv, cover=None):
    """GCOV-like HDF5 file covering the grid (plus a margin), in the grid CRS, north up.

    ``hh`` and ``hv`` are functions of pixel-centre coordinates (x, y) that return linear power.
    ``cover`` limits the granule to x < cover (metres), to test gap filling.
    """
    left, bottom, right, top = grid.bounds
    x = np.arange(left - 200, (cover or right) + 200, PIXEL_M) + PIXEL_M / 2
    y = np.arange(top + 200, bottom - 200, -PIXEL_M) - PIXEL_M / 2
    xx, yy = np.meshgrid(x, y)
    epsg = int(grid.crs.split(":")[1])
    with h5py.File(path, "w") as f:
        g = f.create_group("science/LSAR/GCOV/grids/frequencyA")
        g["HHHH"] = hh(xx, yy).astype(np.float32)
        g["HVHV"] = hv(xx, yy).astype(np.float32)
        g["xCoordinates"] = x
        g["yCoordinates"] = y
        g["projection"] = np.int32(epsg)
        g["projection"].attrs["epsg_code"] = epsg
    return path


def use_files(monkeypatch, files):
    """Make read_to_grid open local files (looked up by granule name) instead of Earthdata results."""
    paths = {f"g{i}": path for i, path in enumerate(files)}
    monkeypatch.setattr(nisar, "_open", lambda granule: paths[granule.name])
    return [nisar.Granule(name, date(2026, 7, 17), None) for name in paths]


def const(value):
    return lambda xx, yy: np.full(xx.shape, value)


def test_constant_scene_gives_its_db_value_everywhere(grid, tmp_path, monkeypatch):
    path = write_granule(tmp_path / "a.h5", grid, hh=const(0.05), hv=const(0.01))
    result = nisar._read_to_grid(use_files(monkeypatch, [path]), grid)
    assert result.layers[NISAR_HH].shape == grid.shape
    assert np.allclose(result.layers[NISAR_HH], 10 * np.log10(0.05), atol=1e-4)
    assert np.allclose(result.layers[NISAR_HV], -20.0, atol=1e-4)
    assert result.granules[0].cells == grid.width * grid.height


def test_value_comes_from_the_pixel_nearest_the_cell_centre(grid, tmp_path, monkeypatch):
    # A linear ramp in x: the 3x3 mean equals the centre pixel, so the result shows which pixel was picked.
    left = grid.bounds[0]
    ramp = lambda xx, yy: 0.001 + (xx - left + 1000) * 1e-5
    path = write_granule(tmp_path / "ramp.h5", grid, hh=ramp, hv=ramp)
    hv = nisar._read_to_grid(use_files(monkeypatch, [path]), grid).layers[NISAR_HV]

    xs, _ = grid.cell_centers()
    x0 = left - 200 + PIXEL_M / 2
    nearest_x = x0 + np.round((xs - x0) / PIXEL_M) * PIXEL_M
    expected = 10 * np.log10(0.001 + (nearest_x - left + 1000) * 1e-5)
    assert np.allclose(hv, expected, atol=1e-3)


def test_window_mean_is_taken_in_linear_units(grid, tmp_path, monkeypatch):
    # Checkerboard of 0.01 and 0.04: any 3x3 window holds 5 of one and 4 of the other.
    left, _, _, top = grid.bounds

    def board(xx, yy):
        i = np.floor((xx - left) / PIXEL_M) + np.floor((top - yy) / PIXEL_M)
        return np.where(i % 2 == 0, 0.01, 0.04)

    path = write_granule(tmp_path / "board.h5", grid, hh=board, hv=board)
    hv = nisar._read_to_grid(use_files(monkeypatch, [path]), grid).layers[NISAR_HV]
    linear_means = {10 * np.log10((5 * 0.01 + 4 * 0.04) / 9), 10 * np.log10((5 * 0.04 + 4 * 0.01) / 9)}
    values = np.unique(np.round(hv, 3))
    assert all(min(abs(v - m) for m in linear_means) < 1e-3 for v in values)
    # A mean of dB values would give something else.
    assert not np.isclose(values, (5 * -20 + 4 * 10 * np.log10(0.04)) / 9, atol=1e-2).any()


def test_no_data_and_values_below_cut_are_dropped(grid, tmp_path, monkeypatch):
    left, bottom, right, top = grid.bounds
    mid_x = (left + right) / 2
    mid_y = (bottom + top) / 2
    hv = lambda xx, yy: np.where(xx < mid_x, 0.0, np.where(yy > mid_y, 10 ** (-3.0), 0.01))  # 0 = no data, -30 dB
    path = write_granule(tmp_path / "holes.h5", grid, hh=const(0.05), hv=hv)
    layer = nisar._read_to_grid(use_files(monkeypatch, [path]), grid).layers[NISAR_HV]

    xs, ys = grid.cell_centers()
    far_from_edges = (np.abs(xs - mid_x) > 60) & (np.abs(ys - mid_y) > 60)
    assert np.isnan(layer[(xs < mid_x) & far_from_edges]).all()
    assert np.isnan(layer[(xs > mid_x) & (ys > mid_y) & far_from_edges]).all()
    assert np.allclose(layer[(xs > mid_x) & (ys < mid_y) & far_from_edges], -20.0, atol=1e-4)


def test_next_granule_only_fills_gaps(grid, tmp_path, monkeypatch):
    left, _, right, _ = grid.bounds
    mid_x = (left + right) / 2
    first = write_granule(tmp_path / "first.h5", grid, hh=const(0.05), hv=const(0.01), cover=mid_x)
    second = write_granule(tmp_path / "second.h5", grid, hh=const(0.05), hv=const(0.02))
    result = nisar._read_to_grid(use_files(monkeypatch, [first, second]), grid)

    hv = result.layers[NISAR_HV]
    assert not np.isnan(hv).any()
    assert np.allclose(np.unique(np.round(hv, 3)), [-20.0, 10 * np.log10(0.02)], atol=1e-3)
    assert [g.name for g in result.granules] == ["g0", "g1"]
    assert sum(g.cells for g in result.granules) == grid.width * grid.height
    assert result.main_day == date(2026, 7, 17)


def test_granule_outside_the_grid_is_skipped(grid, tmp_path, monkeypatch):
    far = make_grid(box(-118.0, 52.0, -117.95, 52.03))
    elsewhere = write_granule(tmp_path / "far.h5", far, hh=const(0.05), hv=const(0.01))
    here = write_granule(tmp_path / "here.h5", grid, hh=const(0.05), hv=const(0.01))
    result = nisar._read_to_grid(use_files(monkeypatch, [elsewhere, here]), grid)
    assert [g.name for g in result.granules] == ["g1"]


def test_no_granules_raises(grid):
    with pytest.raises(nisar.NisarUnavailable, match="no ascending"):
        nisar._read_to_grid([], grid)


def test_granules_without_valid_pixels_raise(grid, tmp_path, monkeypatch):
    path = write_granule(tmp_path / "empty.h5", grid, hh=const(0.0), hv=const(0.0))
    with pytest.raises(nisar.NisarUnavailable, match="none has valid pixels"):
        nisar._read_to_grid(use_files(monkeypatch, [path]), grid)


def test_order_keeps_ascending_passes_closest_to_target_first():
    items = [
        (name("20260801"), "late"),
        (name("20260716"), "close"),
        (name("20260717", "D"), "descending"),
        ("no_date_in_this_name", "broken"),
        (name("20260705"), "early"),
    ]
    ordered = nisar._order_granules(items, 2026)
    assert [g.result for g in ordered] == ["close", "early", "late"]
    assert ordered[0].day == date(2026, 7, 16)
