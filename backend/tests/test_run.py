"""A whole pipeline run on a real grid and the real model library, with every download replaced by synthetic maps."""
import json
from datetime import date

import numpy as np
import pytest
from shapely.geometry import box, mapping

pytest.importorskip("forestrecovery")

from pipeline import model, run as pipeline_run  # noqa: E402
from pipeline.contract import NDVI, NISAR_HH, NISAR_HV, S1_VH, S1_VV
from pipeline.gee import client, gedi, layers
from pipeline.nisar import NisarLayers, UsedGranule

PERIMETER = box(-120.24, 51.12, -120.16, 51.17)  # about 5.6 x 5.6 km near Kamloops, British Columbia
ALPS = box(14.26, 47.28, 14.34, 47.33)           # Austria: same forest type, not in training, no forecast
SIBERIA = box(90.0, 60.0, 90.08, 60.05)          # outside every regional model


def fire(perimeter=PERIMETER):
    return pipeline_run.Fire(id="bc_test_1", name={"en": "Test fire"}, year=2003, perimeter=mapping(perimeter), area_ha=3100)


@pytest.fixture
def offline(monkeypatch):
    """Every download returns plain maps on the grid it is asked for."""
    def full(grid, value):
        return np.full(grid.shape, value, dtype=np.float32)

    def nisar(grid, summer):
        hv = full(grid, -11.0)
        hv[: grid.height // 2] = -18.0  # northern half: young forest, southern half: tall forest
        return NisarLayers(
            {NISAR_HH: full(grid, -5.0), NISAR_HV: hv},
            [UsedGranule("g", date(2026, 7, 18), grid.width * grid.height)],
            below_floor=np.zeros(grid.shape, dtype=bool),
        )

    monkeypatch.setattr(client, "session", lambda: None)
    monkeypatch.setattr(pipeline_run, "nisar_layers", nisar)
    monkeypatch.setattr(layers, "sentinel1", lambda grid, summer: {S1_VH: full(grid, -15.0), S1_VV: full(grid, -9.6)})
    monkeypatch.setattr(layers, "ndvi", lambda grid, summer: {NDVI: full(grid, 0.77)})
    monkeypatch.setattr(layers, "masks", lambda grid, summer: {
        layers.WORLDCOVER: full(grid, 10.0), layers.FOREST_LOSS: full(grid, 0.0), layers.BURNED: full(grid, 0.0),
        layers.LOSS_YEAR: full(grid, 0.0), layers.LAST_FIRE: full(grid, 0.0),
    })
    monkeypatch.setattr(layers, "terrain", lambda grid: {layers.ELEV: full(grid, 600.0), layers.SLOPE: full(grid, 4.0)})
    monkeypatch.setattr(layers, "satellite_images", lambda grid, summer: {
        "sentinel1": {"from": "2026-07-10", "to": "2026-07-24", "scenes": 3},
        "sentinel2": {"from": "2026-07-01", "to": "2026-08-14", "scenes": 10},
    })
    def shots(polygon, grid):
        heights = np.full(grid.shape, np.nan, dtype=np.float32)
        heights[::20, ::20] = 8.6  # sparse GEDI shots everywhere
        return heights

    monkeypatch.setattr(gedi, "shot_heights", shots)
    monkeypatch.setattr(gedi, "reference_height", lambda polygon, grid, zones, heights=None: {"height_m": 19.1, "source": "gedi", "shots": 500})
    monkeypatch.setattr(layers, "optical_rgb", lambda grid, summer: {
        "red": full(grid, 0.04), "green": full(grid, 0.07), "blue": full(grid, 0.03),
    })


def test_run_writes_a_complete_result(offline, tmp_path):
    steps = []
    folder = pipeline_run.run(fire(), 2026, tmp_path, on_step=steps.append)

    assert steps == list(pipeline_run.STEPS)
    result = json.loads((folder / "result.json").read_text(encoding="utf-8"))
    cells = json.loads((folder / "cells.json").read_text(encoding="utf-8"))

    assert result["fire"]["id"] == "bc_test_1"
    assert result["model_result"]["model_version"] == model.MODEL_VERSION
    assert result["model_result"]["region"] == "continental"
    assert result["model_result"]["accuracy"]["error_vs_lidar_pct"] == pytest.approx(11.7)
    assert result["model_result"]["accuracy"]["null_model_mae_m"] > result["model_result"]["accuracy"]["mae_m"]
    assert 0 < result["model_result"]["recovery_today_avg"] < 1.5
    assert result["model_result"]["excluded_share"] == pytest.approx(0.0)
    assert "area_recovered_80pct" not in result["model_result"]
    assert result["satellite_images"]["nisar"] == {"date": "2026-07-18", "fire_covered": 1.0}
    assert result["satellite_images"]["sentinel1"]["scenes"] == 3
    assert result["neighbour_forest"] == {"height_m": 19.1, "source": "gedi"}
    assert sum(result["model_result"]["stage_share"]) == pytest.approx(1.0, abs=1e-3)
    assert result["comparison"]["optics"] == pytest.approx(1.0)  # same NDVI in the burn and around it
    assert result["comparison"]["model"] == result["model_result"]["recovery_today_avg"]
    assert result["comparison"]["lidar"] == pytest.approx(8.6 / 19.1, abs=1e-3)
    assert result["comparison"]["lidar_points_in_fire"] > 0
    assert 0 < len(result["lidar_points"]) <= result["comparison"]["lidar_points_in_fire"]
    assert result["files"]["optical_image"] == "optical.png"
    assert (folder / "optical.png").read_bytes()[:8] == b"\x89PNG\r\n\x1a\n"
    growth = result["growth_forecast"]
    assert growth["year_80pct"] > 2003 and len(growth["interval_80_now"]) == 2
    assert len(growth["series"]["years"]) == len(growth["series"]["recovery"])
    assert "MISSING_COVARIATES_USING_AVERAGES" in result["warnings"]  # no soil or dNBR layers yet

    n = result["map_grid"]["columns"] * result["map_grid"]["rows"]
    assert set(cells) == {"model", "map", "optics"}
    assert all(len(values) == n for group in cells.values() for values in group.values())
    assert {v for v in cells["map"]["zone"] if v is not None} == {0, 1}

    index = json.loads((tmp_path / "index.json").read_text(encoding="utf-8"))
    assert [e["id"] for e in index] == ["bc_test_1"]


def test_no_forecast_outside_canada(offline, tmp_path):
    folder = pipeline_run.run(fire(ALPS), 2026, tmp_path)
    result = json.loads((folder / "result.json").read_text(encoding="utf-8"))
    assert result["growth_forecast"] is None
    assert result["model_result"]["stage_share"] is not None
    assert "REGION_EXTRAPOLATED" in result["warnings"]


def test_place_without_a_model_fails_before_any_download(offline, tmp_path, monkeypatch):
    monkeypatch.setattr(pipeline_run, "_fetch_data", lambda *a: pytest.fail("nothing should be downloaded"))
    with pytest.raises(model.OutOfDomainError):
        pipeline_run.run(fire(SIBERIA), 2026, tmp_path)


def test_fire_from_geojson_computes_the_area(tmp_path):
    path = tmp_path / "fire.geojson"
    path.write_text(json.dumps({"type": "Feature", "properties": {"id": "x_2003_1", "year": 2003}, "geometry": mapping(PERIMETER)}))
    f = pipeline_run.fire_from_geojson(path)
    assert f.name == {"en": "Fire 2003"}
    assert f.area_ha == pytest.approx(3100, rel=0.05)


def test_bare_burn_is_reported_as_excluded(offline, tmp_path, monkeypatch):
    """NDVI under 0.2 is outside the training range: those cells get no model value and are counted as excluded."""
    def ndvi(grid, summer):
        out = np.full(grid.shape, 0.77, dtype=np.float32)
        out[:, : grid.width // 2] = 0.1  # western half bare
        return {NDVI: out}

    monkeypatch.setattr(layers, "ndvi", ndvi)
    folder = pipeline_run.run(fire(), 2026, tmp_path)
    result = json.loads((folder / "result.json").read_text(encoding="utf-8"))
    assert result["model_result"]["excluded_share"] > pipeline_run.MAX_EXCLUDED_SHARE
    assert "MANY_CELLS_EXCLUDED" in result["warnings"]


def test_neighbour_height_without_gedi_is_flagged(offline, tmp_path, monkeypatch):
    monkeypatch.setattr(gedi, "shot_heights", lambda polygon, grid: None)
    monkeypatch.setattr(gedi, "reference_height", lambda polygon, grid, zones, heights=None: {"height_m": 12.0, "source": "eth", "shots": 0})
    folder = pipeline_run.run(fire(), 2026, tmp_path)
    result = json.loads((folder / "result.json").read_text(encoding="utf-8"))
    assert "ACCURACY_NOT_VALIDATED_WITHOUT_GEDI" in result["warnings"]
    assert result["comparison"]["lidar"] is None and result["lidar_points"] == []


def test_failed_optical_picture_does_not_stop_the_run(offline, tmp_path, monkeypatch):
    def broken(grid, summer):
        raise RuntimeError("no Sentinel-2 scenes")

    monkeypatch.setattr(layers, "optical_rgb", broken)
    folder = pipeline_run.run(fire(), 2026, tmp_path)
    result = json.loads((folder / "result.json").read_text(encoding="utf-8"))
    assert result["files"]["optical_image"] is None and not (folder / "optical.png").exists()
