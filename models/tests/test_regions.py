"""Запуск: PYTHONPATH=.:scripts .venv/bin/python tests/test_regions.py"""
import warnings
from pathlib import Path

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")
import model1 as m1
from build_regions import REGIONS, load_country
from forestrecovery import (Growth, OutOfDomainError, footprint_geojson, growth_info, list_regions, load_demo_fire, make_dummy, model_info,
                            predict_arrays, predict_table, region_for, resolve_model, route)

COLS = m1.FEATURE_SETS["S1+NDVI+NISAR"]
RAW = ("nisar_HV", "nisar_HH", "s1_VH", "s1_VV", "NDVI")


def pooled(rid):
    parts = [d for k in REGIONS[rid]["countries"] if (d := load_country(k)) is not None and len(d) > 50]
    return pd.concat(parts, ignore_index=True)


# 1. Кожна регіональна модель = sklearn на даних своїх країн (і лише своїх)
for rid in ("continental", "mediterranean"):
    tr = pooled(rid)
    sk = m1.make_model("logreg").fit(tr[COLS], tr.y)
    out = predict_table(tr, region=rid)
    ok = out.valid.to_numpy()
    diff = np.abs(sk.predict_proba(tr[COLS])[ok] - out[["p_0_5", "p_5_10", "p_gt10"]].to_numpy()[ok]).max()
    assert ok.mean() > 0.99 and diff < 1e-6, (rid, ok.mean(), diff)
    print(f"1 OK  {rid}: збіг із sklearn (макс. різниця {diff:.1e}), {len(tr)} точок, країни {sorted(model_info(rid)['trained_on']['sites'])}")

# 2. Моделі різні, назви й псевдоніми
d = make_dummy(500)
arrs = {c: d[c].to_numpy() for c in RAW}
a = predict_arrays(**arrs)                                               # за замовчуванням continental
assert np.allclose(a["p_forest_gt5"], predict_arrays(**arrs, region="continental")["p_forest_gt5"], equal_nan=True)
assert np.allclose(a["p_forest_gt5"], predict_arrays(**arrs, region="boreal")["p_forest_gt5"], equal_nan=True), "boreal = старий псевдонім"
m = predict_arrays(**arrs, region="mediterranean")
assert not np.allclose(a["p_forest_gt5"], m["p_forest_gt5"], equal_nan=True)
assert resolve_model("Greece") == "mediterranean" and resolve_model("canada") == "continental" and resolve_model("zambia") == "savanna"
for bad in (lambda: predict_arrays(**arrs, region="mars"), lambda: predict_arrays(**arrs, region="monsoon")):
    try:
        bad()
        raise SystemExit("мало бути виключення")
    except ValueError:
        pass
print("2 OK  continental за замовчуванням, псевдоніми, planned-регіон дає зрозумілу помилку")

# 3. Маршрутизація: лише там, де ми дивились (сліди)
cases = {"Квебек (пожежа 1995)": (-76.29, 48.88, "continental", "canada"), "Луганщина (2020)": (38.68, 48.87, "continental", "ukraine"),
         "Манавгат": (31.43, 36.95, "mediterranean", "turkey"), "Закхаро (Греція)": (22.12, 37.26, "mediterranean", "greece"),
         "Амазонія": (-60, -3, None, None), "Замбія": (25.2, -12.66, "savanna", "zambia"), "Танзанія": (36.31, -9.38, "savanna", "tanzania"), "Пекін": (116.4, 39.9, None, None),
         "Сахара": (10, 25, None, None)}
for n, (lo, la, rid, cid) in cases.items():
    r = region_for(lo, la)
    assert r["region"] == rid and r["country"] == cid, (n, r["region"], r["country"])
    assert (r["reliability"] == "out_of_domain") == (rid is None)
assert list(route(np.array([-76.29, 31.43, -60]), np.array([48.88, 36.95, -3]))) == ["continental", "mediterranean", ""]
R = list_regions()
assert set(R["regions"]) == {"continental", "mediterranean", "savanna", "monsoon"} and R["regions"]["savanna"]["status"] == "ready" and R["regions"]["monsoon"]["status"] == "planned"
for reg in R["regions"].values():
    for c in reg["countries"]:
        e = c.get("loco") or c["ceiling"]
        assert e["lo"] <= e["auc"] <= e["hi"], c["id"]
gj = footprint_geojson()
assert len(gj["features"]) > 100 and {f["properties"]["region"] for f in gj["features"]} == {"continental", "mediterranean", "savanna"}
assert len(footprint_geojson("greece")["features"]) < len(gj["features"])
print("3 OK  region_for / route: сліди (Квебек, Луганщина, Манавгат, Закхаро, Замбія, Танзанія) і out_of_domain (Амазонія, Пекін, Сахара)")

# 4. region='auto': скаляри, змішані масиви, поза слідом
q = predict_arrays(**arrs, region="auto", lon=-76.29, lat=48.88)
assert np.allclose(q["p_forest_gt5"], a["p_forest_gt5"], equal_nan=True)
t = predict_arrays(**arrs, region="auto", lon=31.43, lat=36.95)
assert np.allclose(t["p_forest_gt5"], m["p_forest_gt5"], equal_nan=True)
try:
    predict_arrays(**arrs, region="auto", lon=-60, lat=-3)
    raise SystemExit("мало бути OutOfDomainError")
except OutOfDomainError:
    pass
n = predict_arrays(**arrs, region="auto", lon=-60, lat=-3, on_out_of_domain="nan")
assert not n["valid"].any() and (n["stage"] == -1).all() and np.isnan(n["p_forest_gt5"]).all()
lon = np.where(np.arange(500) % 2 == 0, -76.29, 31.43)
lat = np.where(np.arange(500) % 2 == 0, 48.88, 36.95)
mix = predict_arrays(**arrs, region="auto", lon=lon, lat=lat)
assert np.allclose(mix["p_forest_gt5"][::2], a["p_forest_gt5"][::2], equal_nan=True)
assert np.allclose(mix["p_forest_gt5"][1::2], m["p_forest_gt5"][1::2], equal_nan=True)
print("4 OK  auto: скаляри, змішані масиви, out_of_domain (raise / nan)")

# 5. Таблиця з координатами
tb = predict_table(d.assign(longitude=lon, latitude=lat), region="auto")
assert set(tb.model) == {"continental", "mediterranean"}
tb2 = predict_table(d.assign(longitude=-60.0, latitude=-3.0), region="auto")
assert (~tb2.valid).all() and (tb2.model == "").all()
print("5 OK  predict_table(region='auto')")

# 6. Крива росту: лише continental; решта з поясненням
assert abs(Growth(region="continental").tau - Growth().tau) < 1e-12 and abs(Growth(region="boreal").tau - Growth().tau) < 1e-12
assert growth_info("mediterranean")["valid"] is False and growth_info("savanna")["valid"] is False and growth_info()["valid"]
for bad in (lambda: Growth(region="mediterranean"), lambda: Growth(region="greece"), lambda: Growth(region="savanna"),
            lambda: Growth.for_location(31.43, 36.95), lambda: Growth.for_location(-60, -3)):
    try:
        bad()
        raise SystemExit("мало бути виключення")
    except ValueError:
        pass
with warnings.catch_warnings(record=True) as w:
    warnings.simplefilter("always")
    assert abs(Growth(region="turkey", allow_unvalidated=True).tau - Growth().tau) < 1e-12 and any("не підтверджують" in str(x.message) for x in w)
assert Growth(region="mediterranean", A=1.0, tau=5.0).tau == 5.0
assert abs(Growth.for_location(-76.29, 48.88).tau - Growth().tau) < 1e-12               # Канада: крива підтверджена
for lon, lat in ((38.68, 48.87), (-114.2, 46.4)):                                       # Луганщина (Україна), Монтана (США): не підтверджена
    try:
        Growth.for_location(lon, lat)
        raise SystemExit("мало бути виключення")
    except ValueError:
        pass
    with warnings.catch_warnings(record=True) as w:
        warnings.simplefilter("always")
        Growth.for_location(lon, lat, allow_unvalidated=True)
        assert any("не підтверджено" in str(x.message) for x in w)
ev = growth_info()
assert ev["validated_for"] == ["canada"] and "США" in ev["evidence"]
print("6 OK  Growth: Канада ок; США, Україна й інші регіони відмовляють з поясненням")

# 7. Демо Канади
f = load_demo_fire("quebec_1995_1218")
st = f.simulate().stats_at(2026)
assert abs(st["mean_recovery"] - 0.71) < 0.02 and f.predict()["valid"].mean() > 0.25
print("7 OK  демо Квебек 1995: відновлення %.0f%% (DemoFire.predict через auto, у сліді)" % (100 * st["mean_recovery"]))
print("\nУсі перевірки пройдено")

# accuracy: похибка проти GEDI лежить у бібліотеці (поле error_vs_lidar_pct формату результату)
from forestrecovery import accuracy
a = accuracy("canada")
assert a and 10 < a["fire_level"]["error_vs_lidar_pct_median"] < 15 and a["point_level"]["mae_m"] > 3
assert accuracy("mediterranean") is None
print("OK  accuracy('continental'): ±12% на рівні пожежі, ±3.7 м на клітинці")

# савана: модель Замбія + Танзанія працює і маршрутизується за координатами
zz = pd.read_csv(Path(__file__).resolve().parent.parent / "data" / "regions" / "nisar_zambia.csv").head(200)
sv = predict_arrays(zz.nisar_HV, zz.nisar_HH, zz.s1_VH, zz.s1_VV, zz.NDVI, region="savanna")
assert np.isfinite(sv["p_forest_gt5"]).mean() > 0.9 and resolve_model("tanzania") == "savanna"
print("OK  savanna: predict_arrays на точках Замбії")
