"""Batch runs over the demo fires of the model library, with the pipeline run replaced."""
import json

import pytest

pytest.importorskip("forestrecovery")

from pipeline import batch  # noqa: E402


def test_library_fires_have_perimeters_and_main_fires_come_first():
    fires = batch.library_fires(["greece_2007_2212_3726", "quebec_1995_1218", "bc_2003_490"])
    assert [f.id for f in fires] == ["bc_2003_490", "quebec_1995_1218", "greece_2007_2212_3726"]
    assert all(f.perimeter["type"] in ("Polygon", "MultiPolygon") and f.area_ha > 0 for f in fires)
    assert fires[2].name == {"en": "Greece #3726"}


def test_unknown_id_is_rejected():
    with pytest.raises(KeyError, match="not demo fires"):
        batch.library_fires(["no_such_fire"])


def test_batch_skips_done_fires_and_survives_a_failure(tmp_path, monkeypatch):
    fires = batch.library_fires(["bc_2003_490", "quebec_1995_1218", "quebec_2010_557"])
    (tmp_path / "bc_2003_490").mkdir()
    (tmp_path / "bc_2003_490" / "result.json").write_text(json.dumps({}))
    ran = []

    def fake_run(fire, summer, out, on_step=None):
        ran.append(fire.id)
        if fire.id == "quebec_1995_1218":
            raise RuntimeError("no NISAR granules")
        (out / fire.id).mkdir()
        (out / fire.id / "result.json").write_text("{}")

    monkeypatch.setattr(batch, "run", fake_run)
    status = batch.run_many(fires, 2026, tmp_path)
    assert ran == ["quebec_1995_1218", "quebec_2010_557"]
    assert status["bc_2003_490"] == "skipped" and status["quebec_2010_557"] == "done"
    assert status["quebec_1995_1218"].startswith("RuntimeError")
