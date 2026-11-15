"""Запуск: PYTHONPATH=. .venv/bin/python tests/test_growth.py"""
import tempfile
import warnings
from pathlib import Path

import numpy as np

warnings.filterwarnings("ignore")
from forestrecovery import (FireScene, Growth, export_globe, expected_height, globe_html, growth_info, make_dummy,
                            predict_arrays, predict_table, scene_data, stage_from_height)

g = Growth()

# 1. Крива рівня пожежі
assert g.recovery(0) == 0 and g.recovery(-5) == 0
ages, rec = g.curve(70)
assert np.all(np.diff(rec) > 0) and rec[-1] < g.A
t80 = g.years_to(0.8)
assert abs(g.recovery(t80) - 0.8) < 1e-9
assert g.years_to(1.2) == float("inf") and g.years_left(100, 0.8) == 0.0
assert abs(g.years_left(31, 0.8) - (t80 - 31)) < 1e-9
print("1 OK  крива: 80%% на %.1f-му році, A=%.2f, tau=%.1f, пожеж %d" % (t80, g.A, g.tau, growth_info()["n_fires"]))

# 2. Симуляція на синтетичному растрі
rng = np.random.default_rng(1)
H, W = 120, 160
d = make_dummy(H * W)
pred = predict_arrays(**{c: d[c].to_numpy().reshape(H, W) for c in ("nisar_HV", "nisar_HH", "s1_VH", "s1_VV", "NDVI")})
yy, xx = np.mgrid[0:H, 0:W]
burned = np.hypot(yy - H / 2, xx - W / 2) < 40
sim = g.simulate(pred, fire_year=1995, ref_height_m=9.7, now_year=2026, burned=burned)
sel = sim.valid & burned
cur = sim.recovery_at(2026)
assert cur.shape == (H, W) and cur.dtype == np.float32
assert abs(float(np.nanmean(sim.r0[sel])) - g.recovery(31)) < 0.03, "калібрування: середнє = крива моделі 2"
assert np.allclose(cur[sel], sim.r0[sel], atol=1e-5), "сьогодні = стан із радара"
assert np.all(np.isnan(cur[~sim.valid]))
assert np.all(sim.recovery_at(1990)[sim.valid] == 1.0), "до пожежі ліс на місці"
assert np.all(sim.recovery_at(2060)[sel] >= cur[sel] - 1e-6), "ріст не спадає"
assert np.all(sim.recovery_at(2100)[sim.valid & ~burned] == 1.0), "поза згарищем завжди 100%"
assert np.nanmax(sim.recovery_at(2300)) <= g.A + 1e-6
assert np.allclose(sim.height_at(2040), sim.recovery_at(2040) * 9.7, atol=1e-4, equal_nan=True)
assert sim.stage_at(2026).dtype == np.int8
yr = sim.year_reached(0.8)
ok = sel & np.isfinite(yr) & (yr > 1996)
back = np.array([float(sim.recovery_at(y)[i, j]) for (i, j, y) in
                 [(a, b, yr[a, b]) for a, b in list(zip(*np.nonzero(ok)))[:40]]])
assert np.allclose(back, 0.8, atol=1e-3), "recovery_at(year_reached) = ціль"
st = sim.stats_at(2026)
assert 0 <= st["share_target"] <= 1 and abs(st["mean_recovery"] - float(np.nanmean(cur[sel]))) < 1e-5
assert len(sim.timeline(range(1996, 2101, 10))) == 11 and sum(1 for _ in sim.frames([2030, 2040])) == 2
print("2 OK  симуляція: калібрування, монотонність, до пожежі / поза згарищем, year_reached")

# 3. Помилки
for bad in (lambda: g.simulate(pred, fire_year=2030, now_year=2026),
            lambda: g.simulate(pred, fire_year=1995, burned=np.ones((3, 3), bool)),
            lambda: g.simulate(None, fire_year=1995)):
    try:
        bad(); raise SystemExit("мало бути виключення")
    except ValueError:
        pass
print("3 OK  зрозумілі помилки")

# 4. Таблиця
t = predict_table(make_dummy(50))
t["fy"] = 1995
r = g.add_forecast(t, fire_year="fy", ref_height_m=9.7, years=(2040, 2060))
assert {"height_now_m", "recovery_now", "year_reached_80", "recovery_2040", "recovery_2060"} <= set(r.columns)
assert (r.recovery_2060.dropna() >= r.recovery_2040.dropna() - 1e-6).all() and len(r) == 50
t.loc[:24, "fy"] = 2005                                       # різні роки пожеж
assert len(g.add_forecast(t, fire_year="fy", ref_height_m=9.7, years=(2050,))) == 50
print("4 OK  add_forecast (таблиця, різні роки)")

# 5. Сцена і глобус
rgb = rng.uniform(0.02, 0.15, (H, W, 3))
fs = FireScene.from_simulation(sim, id="demo", name="Тест", name_en="Test", lon=-76.3, lat=48.9, rgb=rgb,
                               ndvi=d.NDVI.to_numpy().reshape(H, W), gedi=[(60, 80, 8.0), (30, 40, 12.5)], rot_deg=-14, area_ha=1000)
D = fs.data
assert len(D["c"]) % 8 == 0 and D["nr"] == H // 12 and D["nc"] == W // 12 and len(D["gedi"]) == 2 and D["cellKm"] == 0.36
html = globe_html([fs, fs], standalone=True)
assert "__FIRES__" not in html and "__WORLD__" not in html and html.startswith("<!doctype html>") and '"id":"demo"' in html
assert scene_data([fs])["meta"]["t80"] == round(t80, 1)
with tempfile.TemporaryDirectory() as tmp:
    p = export_globe([fs], Path(tmp) / "g.html")
    assert p.stat().st_size > 100_000
print("5 OK  FireScene + глобус (%d клітинок, HTML %.0f КБ)" % (len(D["c"]) // 8, len(html) / 1e3))
print("\nUсі перевірки пройдено")
