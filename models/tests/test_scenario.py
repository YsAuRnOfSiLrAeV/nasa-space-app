"""Запуск: PYTHONPATH=.:scripts .venv/bin/python tests/test_scenario.py"""
import numpy as np
import pandas as pd

from forestrecovery import OutOfDomainError, Scenario, severity_from_loss

sc = Scenario("mediterranean")
lv = sc.severity_levels()
assert lv["weak"] < lv["medium"] < lv["strong"]

# 1. Сильніша пожежа дає нижчу висоту й повільнішу зелень; зелень зростає з часом
s_w, s_s = sc.structure_level(lv["weak"]), sc.structure_level(lv["strong"])
assert s_w["mean"] > s_s["mean"] + 0.1
yrs = np.arange(1, 16)
gw, gs = sc.greenness(lv["weak"], yrs), sc.greenness(lv["strong"], yrs)
assert np.all(np.diff(gw) >= -1e-12) and np.all(np.diff(gs) >= -1e-12) and np.all(gw > gs)
assert gs[-1] < 1.0 and gw[-1] < 1.01
print("1 OK  слабка: висота %.2f, зелень(15 р) %.2f | сильна: висота %.2f, зелень(15 р) %.2f" % (s_w["mean"], gw[-1], s_s["mean"], gs[-1]))

# 2. Інтервали впорядковані
for v in (0.0, 0.3, 0.6, 1.0):
    s = sc.structure_level(v)
    assert s["lo"] < s["mean"] < s["hi"] and s["mean_lo"] <= s["mean"] + 1e-9 <= s["mean_hi"] + 2e-9
print("2 OK  інтервали: окрема пожежа ширша за інтервал середнього")

# 3. Збіг із даними: середнє по терцилях сили пожежі (спільні перетини країн)
P = pd.read_csv("data/regions/mediterranean_points.csv")
P = P[(P.gediAge >= 3) & P.ndvi_pre.notna()].copy()
P["sev"] = ((P.loss_year >= P.fireYear) & (P.loss_year <= P.fireYear + 1)).astype(float)
P["rec"] = (P.rh98 / P.ref_rh98_med).clip(0, 1.5)
T = P.groupby("fire_id").agg(sev=("sev", "mean"), rec=("rec", "mean"), n=("rh98", "size"), ref=("ref_rh98_med", "first"), refn=("ref_rh98_n", "first"))
T = T[(T.n >= 5) & (T.refn >= 100) & (T.ref > 3)]
T["grp"] = pd.qcut(T.sev.rank(method="first"), 3, labels=["weak", "medium", "strong"])
for name, sev in lv.items():
    obs = T[T.grp == name].rec.mean()
    mod = sc.structure_level(sev)["mean"]
    assert abs(obs - mod) < 0.09, (name, obs, mod)
print("3 OK  модель відтворює середню висоту по терцилях сили пожежі (різниця < 0.09)")

# 4. Країни, регіони, місця
assert Scenario(country="spain").intercept != Scenario(country="greece").intercept
for bad in (lambda: Scenario("continental", country="canada"), lambda: Scenario("continental", country="usa"), lambda: Scenario(country="canada"), lambda: Scenario("savanna"), lambda: Scenario("mars")):
    try:
        bad()
        raise SystemExit("мало бути виключення")
    except ValueError:
        pass
assert Scenario("continental").country == "ukraine" and Scenario.for_location(38.68, 48.87).region == "continental"
assert Scenario.for_location(31.43, 36.95).country == "turkey" and Scenario.for_location(22.12, 37.26).country == "greece"
for lon, lat in ((-60, -3), (-76.29, 48.88)):                          # Амазонія (поза слідом), Квебек (інший регіон)
    try:
        Scenario.for_location(lon, lat)
        raise SystemExit("мало бути OutOfDomainError")
    except OutOfDomainError:
        pass
print("4 OK  країни, регіони, місця (Амазонія й Квебек відмовляють)")

# 5. Масиви й hindcast
s_arr = sc.structure_level(np.array([0.0, 0.5, 1.0]))
assert s_arr["mean"].shape == (3,) and np.all(np.diff(s_arr["mean"]) < 0)
g_arr = sc.greenness(np.array([0.1, 0.9]), range(1, 11))
assert g_arr.shape == (2, 10) and np.all(g_arr[0] > g_arr[1])
h = sc.hindcast(2000, 0.8, until=2026)
assert len(h["year"]) == 26 and h["year"][0] == 2001 and h["year"][-1] == 2026 and list(h["age"][:3]) == [1, 2, 3]
assert h["observed"][[0, 2, 4]].all() and not h["observed"][1] and not h["observed"][5] and h["note"]
w = sc.what_if(fire_year=2000)
assert set(w) == {"weak", "medium", "strong"} and w["weak"]["structure_mean"][0] > w["strong"]["structure_mean"][0]
assert set(sc.what_if(years=range(1, 6))) == {"weak", "medium", "strong"} and len(sc.info()["caveats"]) >= 3
try:
    sc.hindcast(2030, 0.5, until=2026)
    raise SystemExit("мало бути виключення")
except ValueError:
    pass
assert abs(severity_from_loss([2007, 2008, 0, 2012], 2007) - 0.5) < 1e-12
print("5 OK  масиви, hindcast (2001-2026, observed лише 1/3/5 років), what_if, severity_from_loss")
print("\nУсі перевірки пройдено")

# 5. Україна (continental): сильніша пожежа означає нижчий рівень, зелень відновлюється, дані лежать у scenario_continental.json
u = Scenario("continental")
assert u.slope < -0.8 and u.slope_ci[1] < 0 and u.structure_level(0.0)["mean"] > u.structure_level(0.5)["mean"] > u.structure_level(0.9)["mean"]
g = u.greenness(0.8, years=[1, 3, 5, 10])
assert (np.diff(g) > 0).all() and g[0] < 0.8 and u.info()["data"]["n_fires"] >= 40
assert u.p["structure"]["loo_mae"] < u.p["structure"]["null_mae"]
print("5 OK  Україна: нахил від'ємний з інтервалом нижче нуля, зелень зростає, перевірка поза вибіркою краща за середнє")
