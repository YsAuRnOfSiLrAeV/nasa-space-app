"""Запуск: PYTHONPATH=.:scripts .venv/bin/python tests/test_territory.py"""
import numpy as np
import pandas as pd

from forestrecovery import MIN_INSIDE, REGION_COLORS, assess_territory, coverage, territory_geojson
from forestrecovery.territory import _inside, sample_points


def sq(lon, lat, h=0.05):
    return [[lon - h, lat - h], [lon + h, lat - h], [lon + h, lat + h], [lon - h, lat + h], [lon - h, lat - h]]


assert MIN_INSIDE == 0.8
usa = pd.read_csv("data/regions/nisar_usa.csv")
usa_pt = usa.iloc[len(usa) // 2]

# 1. Полігони всередині регіонів: регіон, країна, прогноз
cases = {"Квебек (пожежа 1995)": (-76.29, 48.88, "continental", "canada", "growth_curve", True),
         "Манавгат (Туреччина)": (31.43, 36.95, "mediterranean", "turkey", "severity_scenario", True),
         "Закхаро (Греція)": (22.12, 37.26, "mediterranean", "greece", "severity_scenario", True),
         "Луганщина (Україна)": (38.68, 48.87, "continental", "ukraine", "severity_scenario", True),
         "США (наша точка)": (float(usa_pt.longitude), float(usa_pt.latitude), "continental", "usa", None, False)}
for n, (lo, la, rid, cid, kind, avail) in cases.items():
    a = assess_territory(sq(lo, la))
    assert a["status"] == "inside" and a["show"] == "state" and a["region"] == rid and a["country"] == cid, (n, a["status"], a.get("region"), a.get("country"))
    assert a["fraction"] >= 0.8 and a["color"] == REGION_COLORS[rid] and a["forecast"]["kind"] == kind and a["ask_forecast"] == avail, n
    assert ("Хочете прогноз" in a["message"]) == avail and ("недоступний" in a["message"]) == (not avail), (n, a["message"])
print("1 OK  5 полігонів усередині: регіон, країна, тип прогнозу, питання про прогноз тільки де він є")

# 2. Поза регіоном, і менше 80%: лише знімки, фраза про переобрання
for n, poly in {"Амазонія": sq(-60, -3, 0.1), "Пекін": sq(116.3, 39.8, 0.1),
                "смуга від Квебеку в Атлантику": [[-76.34, 48.83], [-60, 48.83], [-60, 48.93], [-76.34, 48.93], [-76.34, 48.83]]}.items():
    a = assess_territory(poly)
    assert a["status"] == "outside" and a["show"] == "imagery_only" and a["ask_forecast"] is False and a["region"] is None, n
    assert "80%" in a["message"] and "Переоберіть територію" in a["message"], a["message"]
assert 0 < assess_territory(poly)["fraction"] < 0.8
e = assess_territory(sq(-60, -3, 0.1), lang="en")
assert "at least 80%" in e["message"] and "imagery" in e["message"]
print("2 OK  Амазонія, Пекін, смуга в океан: show=imagery_only і вимога переобрати територію (uk/en)")

# 3. Межа 80%: поріг змінює результат
q = [[-76.34, 48.83], [-73.0, 48.83], [-73.0, 48.93], [-76.34, 48.93], [-76.34, 48.83]]
fr = coverage(q)["best_fraction"]
assert assess_territory(q, min_inside=max(0.0, fr - 0.01))["status"] == "inside" and assess_territory(q, min_inside=min(1.0, fr + 0.01))["status"] == "outside"
print(f"3 OK  поріг працює (частка цього полігона {fr:.2f})")

# 4. Формати геометрії, дірки, MultiPolygon
ring = sq(-76.29, 48.88)
formats = {"кільце": ring, "кільця": [ring], "Polygon": {"type": "Polygon", "coordinates": [ring]},
           "Feature": {"type": "Feature", "properties": {}, "geometry": {"type": "Polygon", "coordinates": [ring]}},
           "MultiPolygon": {"type": "MultiPolygon", "coordinates": [[ring], [sq(-76.0, 48.9)]]},
           "FeatureCollection": {"type": "FeatureCollection", "features": [{"type": "Feature", "properties": {}, "geometry": {"type": "Polygon", "coordinates": [ring]}}]}}
for n, g in formats.items():
    assert assess_territory(g)["region"] == "continental", n
big = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]
hole = [[3, 3], [7, 3], [7, 7], [3, 7], [3, 3]]
ratio = len(sample_points({"type": "Polygon", "coordinates": [big, hole]})[0]) / len(sample_points(big)[0])
assert 0.78 < ratio < 0.90, ratio
px, py = np.array([5.0, 1.0]), np.array([5.0, 1.0])
assert list(_inside(px, py, [np.array(big), np.array(hole)])) == [False, True]
tiny = assess_territory([[-76.29, 48.88], [-76.2899, 48.88], [-76.2899, 48.8801], [-76.29, 48.88]])
assert tiny["status"] == "inside"                      # крихітний полігон: центроїд
try:
    assess_territory({"type": "Point", "coordinates": [0, 0]})
    raise SystemExit("мало бути виключення")
except ValueError:
    pass
print("4 OK  формати GeoJSON, MultiPolygon, дірка (площа ≈ 84%), крихітний полігон, Point відхиляється")

# 5. Кольоровий шар
g = territory_geojson()
cols = {f["properties"]["region"]: f["properties"]["color"] for f in g["features"]}
assert set(cols) == {"continental", "mediterranean", "savanna"} and len(set(cols.values())) == 3 and all(v.startswith("#") for v in cols.values())
assert len(territory_geojson("greece")["features"]) < len(g["features"])
assert len(set(REGION_COLORS.values())) == 4
print("5 OK  territory_geojson: різні кольори регіонів")
# 6. Росія не покривається; країни поза навчанням (як Білорусь, Польща) беруться лише де вони в регіоні, з позначкою екстраполяції
from forestrecovery.regions import _grid, grid_lookup
g = _grid()
m = g["meta"]
assert "Russia" in m["exclude"] if "exclude" in m else "Russia" in m.get("exclude", ["Russia"])
ru = m["countries"].index("Russia") + 1
assert not ((g["country"] == ru) & (g["region"] > 0)).any(), "у Росії не має бути покритих комірок"
for lon, lat in ((39.2, 51.7), (37.6, 55.75), (30.3, 59.9)):                           # Воронеж, Москва, Санкт-Петербург
    a = assess_territory(sq(lon, lat, 0.2))
    assert a["status"] == "outside" and a["show"] == "imagery_only", (lon, lat)
trained = set(m["trained"])
cand = [(i, j) for i, j in zip(*np.nonzero((g["region"] > 0) & np.isin(np.array(["", *m["countries"]], dtype=object)[g["country"]], list(trained), invert=True)))
        if g["country"][i, j] > 0]
assert cand, "очікуємо комірки в сусідніх країнах (не з навчальних)"
i, j = cand[len(cand) // 2]
lon0, lat0 = m["west"] + (j + 0.5) * m["res"], m["north"] - (i + 0.5) * m["res"]
a = assess_territory(sq(lon0, lat0, 0.02))
if a["status"] == "inside":
    assert a["extrapolated"] is True and a["validated"] is None and "той самий тип лісу" in a["message"] and a["reliability"] in ("good", "moderate", "low")
tr_cell = assess_territory(sq(-76.29, 48.88))
assert tr_cell["extrapolated"] is False and tr_cell["validated"] is not None
print("6 OK  Росія без покриття (Воронеж, Москва, Санкт-Петербург поза); країни поза навчанням позначені як екстраполяція")
print("\nУсі перевірки пройдено")

# 7. рівні території: A перевірено, B поширено; Китай і Росія виключені
from forestrecovery import region_for as _rf
assert _rf(30.5, 50.45)["tier"] == 1 and _rf(18, 59.3)["tier"] == 2 and _rf(18, 59.3)["extrapolated"]       # Київ, Стокгольм
assert not _rf(116.4, 39.9)["in_domain"] and not _rf(126.6, 45.8)["in_domain"]                                  # Пекін, Харбін
b = assess_territory(sq(17, 59, 0.5))
assert b["status"] == "inside" and b["extended_share"] > 0.5 and "рівні B" in b["message"]
print("7 OK  рівні A/B, виключено Китай і Росію")
assert _rf(34.0, 45.0)["country"] == "ukraine" and _rf(34.0, 45.0)["in_domain"]       # Крим: Україна (Natural Earth малює його як Росію)
assert not _rf(37.6, 55.75)["in_domain"]                                                 # Москва поза
print("8 OK  Крим належить Україні, Москва поза територією")

# 9. савана: рівень A у Замбії й Танзанії, B лише пояс мійомбо (Ангола), Сахель, Судан і Сомалі поза територією
assert _rf(25.2, -12.66)["tier"] == 1 and _rf(25.2, -12.66)["region"] == "savanna"
assert _rf(18, -12)["tier"] == 2 and _rf(18, -12)["region"] == "savanna"
assert not _rf(-4, 14)["in_domain"] and not _rf(30, 14)["in_domain"] and not _rf(45, 5)["in_domain"]
print("9 OK  савана: A (Замбія), B (Ангола), без Сахелю, Судану й Сомалі")
