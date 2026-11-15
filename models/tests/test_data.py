"""Запуск: PYTHONPATH=. .venv/bin/python tests/test_data.py"""
import tempfile
import warnings
from pathlib import Path

import numpy as np

warnings.filterwarnings("ignore")
from forestrecovery import (data_info, demo_globe, demo_scenes, fire_boundaries, list_demo_fires, list_fires, load_demo_fire,
                            load_points, predict_table)

# 1. Список і завантаження демо-пожеж
fires = list_demo_fires()
assert len(fires) >= 4 and all(f["pixel_m"] == 90 for f in fires)
assert [f["id"] for f in fires[:4]] == ["quebec_1995_1218", "quebec_2010_557", "ontario_1988_21", "bc_2003_490"]   # перші чотири лишаються першими
for f in fires:
    d = load_demo_fire(f["id"])
    assert d.shape == tuple(f["shape"]) and d.burned.shape == d.outside.shape == d.rgb.shape[:2]
    assert d.inputs["NDVI"].dtype == np.float32 and np.isnan(d.inputs["nisar_HV"][d.outside]).all()
    pred = d.predict()
    assert 0.10 < pred["valid"].mean() < 0.9 and pred["p_forest_gt5"].shape == d.shape
    if d.meta.get("static"):          # поза Канадою прогнозу росту в часі немає: перевіряємо лише стан (модель 1)
        assert np.nanmean(pred["p_forest_gt5"][pred["valid"]]) > 0.2
        continue
    sim = d.simulate()
    st = sim.stats_at(2026)
    assert 0.3 < st["mean_recovery"] < 0.95, st
    assert abs(st["mean_recovery"] - st["model_recovery"]) < 0.03, "калібрування до кривої моделі 2"
    assert len(d.gedi) >= 10 and 0 <= d.gedi[0][0] < d.shape[0]
print("1 OK  4 демо-пожежі: растри, модель, симуляція (відновлення зараз збігається з кривою)")

# 2. Невідома пожежа - зрозуміла помилка
try:
    load_demo_fire("nope")
    raise SystemExit("мало бути виключення")
except KeyError as e:
    print("2 OK ", e)

# 3. Таблиці й контури
pts = load_points()
r = predict_table(pts)
assert len(pts) == 1203 and r.valid.mean() > 0.95 and {"rh98", "fire_id", "latitude"} <= set(pts.columns)
assert len(list_fires()) == 55 and len(fire_boundaries()["features"]) == 55
print("3 OK  точки (%d), пожежі (%d), контури" % (len(pts), len(list_fires())))

# 4. Глобус з вбудованих даних
sc = demo_scenes()
assert len(sc) == len(fires) and all(len(s.data["c"]) // 8 > 300 for s in sc)   # менші пожежі мають менше клітинок (Замбія 2016: ~400)
with tempfile.TemporaryDirectory() as tmp:
    p = demo_globe(Path(tmp) / "g.html")
    assert p.stat().st_size > 400_000
info = data_info()
assert "GEDI" in info["sources"]["height"] and "points.csv.gz" in info["files"]
print("4 OK  demo_globe, data_info\n\nУсі перевірки пройдено")
