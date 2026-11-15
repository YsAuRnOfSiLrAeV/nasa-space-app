"""Result files in the agreed format, from synthetic layers."""
import json

import numpy as np
import pytest
from affine import Affine
from shapely.geometry import Polygon, box

from pipeline import export
from pipeline.grid import CELL_M, Grid, make_grid

FIRE = box(-120.24, 51.12, -120.16, 51.17)


@pytest.fixture(scope="module")
def grid():
    return make_grid(FIRE)


def big_grid(width, height):
    return Grid("EPSG:32610", Affine(CELL_M, 0, 600_000, 0, -CELL_M, 5_700_000), width, height)


def result_for(grid, factor):
    return {
        "fire": {
            "id": "bc_test_1",
            "name": {"uk": "Тест", "en": "Test"},
            "year": 2003,
            "area_ha": 3100,
            "perimeter": FIRE.__geo_interface__,
        },
        "satellite_images": {"summer": 2026},
        "map_grid": export.map_grid(grid, factor),
        "neighbour_forest": {"height_m": 19.1, "source": "gedi"},
        "model_result": {"recovery_today_avg": 0.36, "area_recovered_80pct": 0.0},
        "growth_forecast": None,
        "comparison": {"optics": 0.95, "model": 0.36, "lidar": None, "lidar_points_in_fire": 0},
        "lidar_points": [],
        "warnings": [],
    }


def test_display_factor_is_base_for_normal_fires_and_grows_for_huge_ones(grid):
    assert export.display_factor(grid) == export.BASE_FACTOR
    huge = big_grid(5000, 4000)  # about Fort McMurray with the ring
    factor = export.display_factor(huge)
    assert factor > export.BASE_FACTOR
    assert np.ceil(5000 / factor) * np.ceil(4000 / factor) <= export.MAX_DISPLAY_CELLS


def test_map_grid_covers_the_grid(grid):
    section = export.map_grid(grid, 3)
    assert section["cell_size_m"] == 90
    assert section["columns"] == -(-grid.width // 3) and section["rows"] == -(-grid.height // 3)
    display = Polygon(section["corners_lonlat"])
    assert display.buffer(1e-6).contains(Polygon(grid.corners_lonlat()))


def test_mode_takes_the_most_common_category():
    layer = np.array([[0, 0, 2], [0, 1, 2], [np.nan, 1, 2]], dtype=np.float32)
    assert export.coarsen(layer, 3, export.MODE)[0, 0] == 0


def test_median_ignores_missing_cells():
    layer = np.array([[0.1, 0.2, 0.3], [0.4, 0.5, np.nan], [np.nan, np.nan, 0.9]], dtype=np.float32)
    assert export.coarsen(layer, 3, export.MEDIAN)[0, 0] == pytest.approx(0.35)


def test_block_with_too_few_values_is_empty():
    layer = np.full((3, 3), np.nan, dtype=np.float32)
    layer[0, :] = 1.0  # 3 of 9 cells
    assert np.isnan(export.coarsen(layer, 3, export.MODE)[0, 0])


def test_edge_blocks_are_padded():
    layer = np.ones((4, 4), dtype=np.float32)
    out = export.coarsen(layer, 3, export.MEDIAN)
    assert out.shape == (2, 2)
    assert out[0, 0] == 1.0 and np.isnan(out[1, 1])  # 1 of 9 cells in the corner block


def test_cells_json_layout(grid):
    stage = np.full(grid.shape, 2.0, dtype=np.float32)
    stage[:3, :3] = np.nan
    prob = np.full(grid.shape, 0.876, dtype=np.float32)
    cells = export.cells_json({("model", "stage"): stage, ("model", "p_forest_gt5"): prob}, factor=3)
    columns = -(-grid.width // 3)
    n = columns * -(-grid.height // 3)
    assert len(cells["model"]["stage"]) == n
    assert cells["model"]["stage"][0] is None            # the empty block in the top-left corner
    assert cells["model"]["stage"][1] == 2               # index = row * columns + col
    assert cells["model"]["p_forest_gt5"][1] == 88       # percent, integer
    assert "recovery" not in cells["model"]              # layers that were not given are not written


def test_unknown_layer_is_rejected(grid):
    with pytest.raises(KeyError):
        export.cells_json({("model", "height"): np.zeros(grid.shape)}, 3)


def test_write_fire_and_index(grid, tmp_path):
    factor = export.display_factor(grid)
    result = result_for(grid, factor)
    cells = export.cells_json({("map", "zone"): np.ones(grid.shape, dtype=np.float32)}, factor)
    folder = export.write_fire(tmp_path, result, cells, optical_png=b"\x89PNG")

    written = json.loads((folder / "result.json").read_text())
    assert written["schema_version"] == export.SCHEMA_VERSION
    assert written["files"] == {"cells": "cells.json", "optical_image": "optical.png"}
    assert written["fire"]["name"]["uk"] == "Тест"
    assert json.loads((folder / "cells.json").read_text()) == cells
    assert (folder / "optical.png").read_bytes() == b"\x89PNG"

    export.update_index(tmp_path, result)
    index = export.update_index(tmp_path, result)  # same fire again replaces its entry
    assert len(index) == 1
    assert index[0]["result"] == "bc_test_1/result.json"
    assert index[0]["center_lonlat"] == pytest.approx([-120.2, 51.145], abs=1e-3)


def test_write_fire_checks_sections_and_lengths(grid, tmp_path):
    result = result_for(grid, 3)
    with pytest.raises(ValueError, match="missing sections: warnings"):
        export.write_fire(tmp_path, {k: v for k, v in result.items() if k != "warnings"}, {})
    with pytest.raises(ValueError, match="map_grid needs"):
        export.write_fire(tmp_path, result, {"map": {"zone": [1, 2, 3]}})
