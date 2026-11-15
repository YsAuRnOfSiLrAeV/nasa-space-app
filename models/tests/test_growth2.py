"""Прогноз росту зі змінними (forestrecovery.growth2): монотонність, типова пожежа, зона Канади, попередження, відповідність файлу моделі."""
import json
from pathlib import Path

import numpy as np

from forestrecovery import OutOfDomainError, forecast_recovery, growth_covariates_info

m = growth_covariates_info()
g = forecast_recovery(2003)
assert abs(g["tau"] - np.exp(m["intercept"])) < 0.01 and "MISSING_COVARIATES_USING_AVERAGES" in g["warnings"]
r = np.array(g["recovery"]); assert (np.diff(r) > 0).all() and r[0] == 0 and (r < 1).all()
assert all(lo <= x <= hi for lo, x, hi in zip(g["low"], g["recovery"], g["high"]))
assert abs(g["years_to_80pct"] - (-g["tau"] * np.log(0.2))) < 0.2 and g["year_80pct"] == round(2003 + g["years_to_80pct"])
print("1 OK  типова пожежа: tau, монотонність, інтервал, рік 80%")

slow = forecast_recovery(2003, dict(dnbr=900, ref_rh98_med=22, dist_edge_m=5000))
fast = forecast_recovery(2003, dict(dnbr=100, ref_rh98_med=8, dist_edge_m=100))
assert slow["tau"] > g["tau"] > fast["tau"]                               # сильніша пожежа, вищий сусідній ліс і далекий край: повільніше
assert "dist_edge_m" in slow["used"] and "COVARIATE_OUT_OF_TRAINING_RANGE" in forecast_recovery(2003, dict(dnbr=5000))["warnings"]
assert "FORECAST_EXTRAPOLATES_BEYOND_AGE_36" in forecast_recovery(2003, horizon=40)["warnings"] and "FORECAST_EXTRAPOLATES_BEYOND_AGE_36" not in forecast_recovery(2000, horizon=5)["warnings"]
assert "AGE_BELOW_VALIDATED" in forecast_recovery(2022)["warnings"]
print("2 OK  змінні рухають tau в очікуваному напрямку, попередження про діапазони й вік")

for lon, lat in ((31, 49), (-60, -3), (116, 40)):                           # Україна, Амазонія, Китай
    try:
        forecast_recovery(2003, lon=lon, lat=lat); raise SystemExit("мало бути виключення")
    except OutOfDomainError:
        pass
assert forecast_recovery(2003, lon=-120.2, lat=51.1)["tau"] > 0
assert "NOT_VALIDATED_REGION" in forecast_recovery(2003, lon=31, lat=49, allow_unvalidated=True)["warnings"]
print("3 OK  лише Канада: Україна, Амазонія й Китай дають OutOfDomainError")

assert m["cv"]["tau від змінних"]["r2_fire"] > m["cv"]["tau постійна"]["r2_fire"] and m["n_fires"] >= 50 and len(m["coef"]) == len(m["features"])
print("4 OK  метрики перевірки в файлі моделі: зі змінними кращі за сталу tau")
