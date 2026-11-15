"""Запуск: PYTHONPATH=.:scripts .venv/bin/python tests/test_bundle.py"""
import json
import tempfile
import warnings

import struct

from forestrecovery import catalog, export_all, fire_bundle, write_fire_bundle

warnings.filterwarnings("error", message="Mean of empty slice")       # порожні клітинки не мають давати попередження

c = catalog()
ids = {o["id"] for o in c}
assert len(c) == len(ids) >= 80 and {"quebec_1995_1218", "bc_2009_338", "greece_2007_2212_3726", "ontario_1988_34"} <= ids
assert {o["forecast"] for o in c} == {"growth", "state_only", "none"}
assert all(o["forecast"] == "state_only" for o in c if o["region"] in ("greece", "spain", "turkey", "ukraine"))
print("1 OK  каталог: %d пожеж, прогноз: growth / state_only / none" % len(c))

b = fire_bundle("quebec_1995_1218")                         # повна сітка, Канада
r = b["result"]
assert r["model1"]["unit"] == "cell" and r["model1"]["n"] > 5000 and 0.4 < r["model1"]["mean"] < 0.8
assert 0 <= r["model1"]["excluded_share"] < 0.02 and r["model1"]["used_pixels"] <= r["model1"]["burned_pixels"]
assert 0.05 < fire_bundle("bc_2003_515")["result"]["model1"]["excluded_share"] < 0.15      # у цієї пожежі виключено ~9% згарища
assert 0 <= fire_bundle("bc_2009_338")["result"]["model1"]["excluded_share"] < 1       # для точок: частка точок поза межами моделі
assert r["model2"]["forecast"] == "growth" and 2015 < r["model2"]["year_80pct"] < 2035 and 0.7 < r["model2"]["now_recovery"] < 0.95
assert len(b["cells"]["cells"]) == r["model1"]["n"] and b["polygon"]["geometry"] and r["grid"]["crs_pipeline"] == "EPSG:32618"
assert r["model1"]["meaning"] == "ranking_score_not_calibrated_probability" and "model2" in r["reliability"]
# клітинки прив'язані до землі: усі всередині рамки контуру пожежі, а центр сітки збігається з центром пожежі в метаданих
cl = b["cells"]["cells"]
assert all({"x", "y"} <= set(c) for c in cl)
try:
    import pyproj  # noqa: F401
    lons, lats = [c["lon"] for c in cl], [c["lat"] for c in cl]
    from forestrecovery.data import _demo_meta
    meta = next(d for d in _demo_meta() if d["id"] == "quebec_1995_1218")
    assert abs(sum(lons) / len(lons) - meta["lon"]) < 0.3 and abs(sum(lats) / len(lats) - meta["lat"]) < 0.2, (sum(lons) / len(lons), sum(lats) / len(lats))
    assert -77.2 < min(lons) and max(lons) < -75.2 and 48.3 < min(lats) and max(lats) < 49.5
    print("   клітинки мають lon, lat у межах пожежі (%.3f..%.3f, %.3f..%.3f)" % (min(lons), max(lons), min(lats), max(lats)))
except ImportError:
    print("   pyproj не встановлено: клітинки мають лише x, y у метрах проєкції")
assert len(b["cells"]["gedi"]) >= 20 and all({"x", "y", "rh98_m"} <= set(g) for g in b["cells"]["gedi"])
print("2 OK  повна сітка, Канада: клітинки, модель 1, прогноз у роках, контур")

b = fire_bundle("bc_2009_338")                              # лише точки, Канада
assert b["cells"] is None and b["result"]["model1"]["unit"] == "point" and b["result"]["model2"]["forecast"] == "growth"
print("3 OK  лише точки: оцінка в точках і прогноз, без клітинок")

b = fire_bundle("greece_2007_2212_3726")                    # поза Канадою
assert b["result"]["model2"]["forecast"] == "none" and "outside Canada" in b["result"]["model2"]["reason"] and b["cells"]["cells"]
assert b["polygon"]["geometry"] and "polygon.geojson" in b["manifest"]["files"]      # контур є і для додаткових пожеж
b = fire_bundle("ontario_1988_34")                          # лише контур
assert b["result"]["model1"] is None and b["result"]["model2"]["forecast"] == "none" and b["polygon"]
print("4 OK  поза Канадою і лише контур: прогнозу немає, причина пояснена текстом")

try:
    fire_bundle("nope")
    raise SystemExit("мало бути KeyError")
except KeyError as e:
    assert "catalog()" in str(e)
with tempfile.TemporaryDirectory() as d:
    paths = write_fire_bundle("quebec_1995_1218", d)
    names = sorted(p.name for p in paths)
    assert names == ["cells.geojson", "cells.json", "gedi.geojson", "manifest.json", "polygon.geojson", "result.json", "rgb.png", "timeline.json"], names
    by = {p.name: p for p in paths}
    man = json.loads(by["manifest.json"].read_text())
    assert man["bundle_format"] == 2 and sorted(man["files"]) == sorted(["manifest.json"] + [n for n in names if n != "manifest.json"]) and set(man["roles"]) == set(man["files"])
    assert json.loads(by["result.json"].read_text())["fire"]["id"] == "quebec_1995_1218" and "fire_quebec_1995_1218" in str(paths[0])
    png = by["rgb.png"].read_bytes()
    im = json.loads(by["result.json"].read_text())["image"]
    assert png[:8] == b"\x89PNG\r\n\x1a\n" and struct.unpack(">II", png[16:24]) == (im["width"], im["height"])
print("5 OK  write_fire_bundle пише набір файлів за manifest, PNG коректний, невідома пожежа дає зрозумілу помилку")

# нові файли для карти: клітинки як квадрати в lon/lat, відновлення по роках, узгодженість із клітинками
b = fire_bundle("quebec_1995_1218")
cl, gj, tl = b["cells"]["cells"], b["cells_geojson"], b["timeline"]
assert {"recovery", "height_m", "ndvi", "p_forest_gt5"} <= set(cl[0]) and b["cells"]["reference_source"] == "gedi_neighbour_forest_median"
assert len(gj["features"]) == len(cl) and gj["features"][5]["properties"]["i"] == 5
ring = gj["features"][100]["geometry"]["coordinates"][0]
assert len(ring) == 5 and ring[0] == ring[-1] and abs(sum(p[0] for p in ring[:4]) / 4 - cl[100]["lon"]) < 1e-3 and abs(sum(p[1] for p in ring[:4]) / 4 - cl[100]["lat"]) < 1e-3
assert tl["years"][0] == 1995 and tl["years"][-1] == 2066 and len(tl["recovery_pct"]) == len(tl["years"]) and len(tl["recovery_pct"][0]) == len(cl)
now = [v for v in tl["recovery_pct"][2026 - 1995] if v is not None]
mean_now = sum(c["recovery"] for c in cl if c["recovery"] is not None) / len(cl)
assert abs(sum(now) / len(now) / 100 - mean_now) < 0.02, (sum(now) / len(now) / 100, mean_now)         # стан зараз у клітинках і в timeline однаковий
assert abs(mean_now - b["result"]["model2"]["now_recovery"]) < 0.08                                     # піксельний метод і крива моделі 2: різниця невелика
late = [v for v in tl["recovery_pct"][-1] if v is not None]
assert sum(late) / len(late) / 100 > mean_now                                                           # з роками відновлення росте
img = b["result"]["image"]
assert len(img["corners_lonlat"]) == 4 and img["file"] == "rgb.png" and b["gedi_geojson"]["features"][0]["geometry"]["type"] == "Point"
g = fire_bundle("greece_2007_2212_3726")                    # поза Канадою: карта є, прогнозу в роках немає
assert g["timeline"] is None and "timeline.json" not in g["manifest"]["files"] and g["rgb_png"] and g["cells"]["cells"][0]["height_m"] is not None
z = fire_bundle("zambia_2005_2427_-1412")                   # савана: еталона GEDI немає, джерело названо чесно
assert z["result"]["model1"]["unit"] == "cell" and z["cells"]["reference_source"].startswith("scene_p75") and z["result"]["reference"]["source"].startswith("scene_p75")
assert z["result"]["model1"]["mean"] > 0.5 and z["result"]["fire"]["model_region"] == "savanna" and z["timeline"] is None
p = fire_bundle("bc_2009_338")
assert p["rgb_png"] is None and p["cells_geojson"] is None and p["timeline"] is None
assert sorted(p["manifest"]["files"]) == ["manifest.json", "polygon.geojson", "result.json"]
print("6 OK  cells.geojson, gedi.geojson, rgb.png, timeline.json: форма, узгодженість чисел, савана з чесним еталоном, пожежі без растрів без зайвих файлів")

with tempfile.TemporaryDirectory() as d:
    idx = export_all(d, ["quebec_1995_1218", "zambia_2005_2427_-1412", "bc_2009_338"])
    ix = json.loads(idx.read_text())
    assert ix["bundle_format"] == 2 and len(ix["fires"]) == 3
    assert {f["id"] for f in ix["fires"]} == {"quebec_1995_1218", "zambia_2005_2427_-1412", "bc_2009_338"}
    import os
    assert all(os.path.exists(os.path.join(d, f["dir"], n)) for f in ix["fires"] for n in f["files"]) and os.path.exists(os.path.join(d, "viewer.html"))
    q = next(f for f in ix["fires"] if f["id"] == "quebec_1995_1218")
    assert "timeline.json" in q["files"] and q["year_80pct"] and 0 < q["model1_mean"] < 1
    try:
        export_all(d, ["nope"])
        raise SystemExit("мало бути KeyError")
    except KeyError:
        pass
print("7 OK  export_all: index.json, viewer.html, усі файли з index існують")

# static-пожежа не дає прогнозу росту без прямого дозволу
from forestrecovery import OutOfDomainError, load_demo_fire
f = load_demo_fire("greece_2007_2212_3726")
assert f.static
try:
    f.simulate()
    raise SystemExit("мало бути OutOfDomainError")
except OutOfDomainError:
    pass
assert f.simulate(allow_unvalidated=True).stats_at(2026)["mean_recovery"] > 0
try:
    import pyproj  # noqa: F401
    q = load_demo_fire("quebec_1995_1218").corners_lonlat()
    assert len(q) == 4 and all(-78 < c[0] < -75 and 48 < c[1] < 50 for c in q)
    assert q[0][1] > q[3][1] and q[1][0] > q[0][0] - 1       # верх північніше за низ
    print("   corners_lonlat: 4 кути растра в lon/lat")
except ImportError:
    pass
print("8 OK  пожежа поза Канадою: simulate() відмовляє, allow_unvalidated=True дає лише ілюстрацію")
print("\nУсі перевірки пройдено")
