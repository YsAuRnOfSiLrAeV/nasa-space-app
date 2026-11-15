"""Прогноз росту з урахуванням змінних пожежі (Канада): що буде через N років для цієї пожежі.

    from forestrecovery import forecast_recovery
    f = forecast_recovery(fire_year=2003, covariates=dict(dnbr=520, slope=3, soil_clay=18, ref_rh98_med=19.1), horizon=40)
    f["years"], f["recovery"], f["low"], f["high"], f["tau"], f["years_to_80pct"], f["warnings"]

Модель: відновлення r(вік) = 1 - exp(-вік / tau), tau = exp(b0 + сума b_i * z_i), z = стандартизовані змінні (growth_covariates.json,
scripts/build_growth_model.py). Відновлення = висота лісу / висота сусіднього незгорілого лісу. Перевірено лише для Канади і віку пожежі 8-36 років
(вік поза цим діапазоном = екстраполяція, є в warnings). Змінні, яких немає, беруться середніми за навчанням (є в warnings), тому прогноз без змінних = типова пожежа.
Залежності: лише numpy.
"""
import json
from pathlib import Path

import numpy as np

from .regions import OutOfDomainError

_M = None


def _model():
    global _M
    if _M is None:
        _M = json.loads((Path(__file__).parent / "growth_covariates.json").read_text(encoding="utf-8"))
    return _M


def growth_covariates_info():
    """Опис моделі: змінні, коефіцієнти, діапазони, метрики перевірки (dict з growth_covariates.json)."""
    return _model()


def _in_canada_zone(lon, lat):
    from .territory import _inside, _polygons, growth_zone_geojson

    pts = (np.array([float(lon)]), np.array([float(lat)]))
    return any(_inside(pts[0], pts[1], rings)[0] for rings in _polygons(growth_zone_geojson()))


def forecast_recovery(fire_year, covariates=None, horizon=40, now_year=2026, step=1, lon=None, lat=None, allow_unvalidated=False):
    """Прогноз відновлення пожежі по роках. Повертає dict: years (календарні), age, recovery (частка 0..1), low, high (80% інтервал для пожежі),
    tau, years_to_80pct (від року пожежі), year_80pct, now_recovery, used (змінні, що задані), missing, out_of_range, warnings.

    covariates: dict змінних (dnbr, nbr_pre, ref_frac_needle, ref_frac_decid, treecover2000, elev, slope, soil_clay, soil_sand, soil_org_c, dist_edge_m,
    fire_size_log (= log10 площі в га), ref_rh98_med (висота сусіднього лісу, м)); можна не всі. lon, lat: якщо задані, перевіряється, що це Канада
    (де крива підтверджена); поза нею OutOfDomainError, якщо не allow_unvalidated."""
    m = _model()
    warns = []
    if lon is not None and lat is not None and not _in_canada_zone(lon, lat):
        if not allow_unvalidated:
            raise OutOfDomainError("Прогноз росту підтверджено лише для Канади (перевірений регіон); для цієї точки його немає.")
        warns.append("NOT_VALIDATED_REGION")
    cov = dict(covariates or {})
    z, used, missing, oor = [], [], [], []
    for f, b in zip(m["features"], m["coef"]):
        v = cov.get(f)
        if v is None or not np.isfinite(float(v)):
            z.append(0.0); missing.append(f); continue
        v = float(v)
        z.append((v - m["mean"][f]) / m["sd"][f]); used.append(f)
        lo, hi = m["ranges"][f]
        if v < lo or v > hi:
            oor.append(f)
    z = np.array(z)
    tau = float(np.exp(np.clip(m["intercept"] + z @ np.array(m["coef"]), np.log(3), np.log(400))))
    age_now = now_year - fire_year
    ages = np.arange(0, age_now + horizon + 1e-9, step, dtype=float)
    rec = 1 - np.exp(-ages / tau)
    sd = m["fire_sd"]
    low, high = np.clip(rec - 1.28 * sd, 0, 1.3), np.clip(rec + 1.28 * sd, 0, 1.3)
    lo_age, hi_age = m["reliable_age"]
    if age_now < lo_age:
        warns.append("AGE_BELOW_VALIDATED")
    if age_now + horizon > hi_age:
        warns.append("FORECAST_EXTRAPOLATES_BEYOND_AGE_36")
    if missing:
        warns.append("MISSING_COVARIATES_USING_AVERAGES")
    if oor:
        warns.append("COVARIATE_OUT_OF_TRAINING_RANGE")
    t80 = float(-tau * np.log(0.2))
    return dict(fire_year=int(fire_year), years=(fire_year + ages).astype(int).tolist(), age=ages.tolist(), recovery=[round(float(x), 4) for x in rec],
                low=[round(float(x), 4) for x in low], high=[round(float(x), 4) for x in high], tau=round(tau, 2), years_to_80pct=round(t80, 1),
                year_80pct=int(round(fire_year + t80)), now_recovery=round(float(1 - np.exp(-age_now / tau)), 4), now_year=now_year, used=used, missing=missing,
                out_of_range=oor, reliable_age=[lo_age, hi_age], warnings=warns, cv=m["cv"]["tau від змінних"])
