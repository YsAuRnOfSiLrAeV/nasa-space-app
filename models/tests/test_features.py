"""Запуск: PYTHONPATH=.:scripts .venv/bin/python tests/test_features.py"""
import json
from pathlib import Path

import numpy as np

import forestrecovery
from forestrecovery import feature_spec, input_report, make_dummy
from forestrecovery.core import _model

PKG = Path(forestrecovery.__file__).parent        # працює і з установленого пакета, і з вихідників
sp = feature_spec()
assert set(sp["inputs"]) == {"nisar_HV", "nisar_HH", "s1_VH", "s1_VV", "NDVI"} and all(v["required"] for v in sp["inputs"].values())
assert set(sp["models"]) == {"continental", "mediterranean", "savanna"} and set(sp["derived_inside_library"]) == {"nisar_HVmHH", "s1_VHmVV"}
for r, m in sp["models"].items():
    mm = json.load(open(PKG / "models" / f"{r}.json"))
    assert m["valid_ranges"] == mm["ranges"] and m["features_order"] == mm["features"], r
    assert set(m["features_order"]) == {"s1_VV", "s1_VH", "s1_VHmVV", "NDVI", "nisar_HV", "nisar_HH", "nisar_HVmHH"}
assert set(feature_spec("greece")["models"]) == {"mediterranean"} and sp["forecast_inputs"]["ref_height_m"] and sp["season"]
print("1 OK  feature_spec збігається з моделями (ознаки й діапазони)")

# діапазони в FEATURES.md збігаються з моделями (числово, з допуском на округлення до 0.1)
import re
md = open(PKG / "FEATURES.md", encoding="utf-8").read()
num = lambda t: float(t.replace("−", "-").replace(",", "."))
col = {"continental": 0, "mediterranean": 1, "savanna": 2}
for r in sp["models"]:
    for k, (lo, hi) in sp["models"][r]["valid_ranges"].items():
        row = [l for l in md.splitlines() if l.startswith(f"| `{k}` |") and "…" in l][0]
        cell = [c.strip() for c in row.strip("|").split("|")][1 + col[r]]
        a, b = (num(x) for x in cell.split("…"))
        assert abs(a - lo) < 0.06 and abs(b - hi) < 0.06, (r, k, cell, lo, hi)
print("2 OK  таблиця діапазонів у FEATURES.md збігається з моделями")

# input_report: добрі дані й типові помилки
d = make_dummy(500)
good = {c: d[c].to_numpy() for c in ("nisar_HV", "nisar_HH", "s1_VH", "s1_VV", "NDVI")}
r = input_report(**good)
assert r["ok"] and r["valid_share"] > 0.95 and not r["issues"]
lin = dict(good, nisar_HV=10 ** (good["nisar_HV"] / 10))                       # лінійна потужність замість dB
assert any("лінійну потужність" in i for i in input_report(**lin)["issues"])
sc = dict(good, NDVI=good["NDVI"] * 10000)                                       # масштаб 0..10000
assert any("10000" in i for i in input_report(**sc)["issues"])
nan = dict(good, s1_VH=np.full(500, np.nan))
assert any("NaN" in i for i in input_report(**nan)["issues"])
bad = dict(good, nisar_HH=good["nisar_HH"][:100])
assert any("форми" in i for i in input_report(**bad)["issues"])
assert input_report(**good, region="greece")["region"] == "mediterranean"
print("3 OK  input_report: добрі дані, лінійні одиниці, NDVI 0..10000, NaN, різні форми")
print("\nУсі перевірки пройдено")
