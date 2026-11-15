"""Ріст лісу в часі: модель 2 (крива відновлення за віком) + симуляція «від поточного стану» для кожного пікселя.

Залежності: лише numpy (pandas потрібен тільки для Growth.add_forecast).

Ідея (та сама, що в демо з деревами):
  1. Крива відновлення за віком пожежі:  recovery(age) = A * (1 - exp(-age / tau)),  recovery = висота / висота лісу до пожежі.
     Параметри A і tau підігнані на 49 пожежах Канади (growth.json). За стабільних умов типова пожежа досягає 80% приблизно за 41 рік.
  2. Сьогоднішній стан кожного пікселя береться з радара (predict_arrays): очікувана висота з ймовірностей класів / висота лісу до пожежі.
  3. Кожен піксель отримує свій tau, щоб його крива проходила через цей стан, і далі росте до A (100%) зі своєю швидкістю.
Це ілюстрація за стабільних умов (без нових пожеж, клімату й випадковості); за межами віку 9-35 років прогноз - екстраполяція.

Приклад:
    from forestrecovery import predict_arrays, Growth
    pred = predict_arrays(nisar_HV=hv, nisar_HH=hh, s1_VH=vh, s1_VV=vv, NDVI=ndvi)       # 2D растри
    sim = Growth().simulate(pred, fire_year=1995, ref_height_m=9.7, burned=burn_mask)
    sim.recovery_at(2050)        # 2D масив 0..1: яка частка довоєнної висоти досягнута в 2050 р.
    sim.height_at(2050)          # метри
    sim.stats_at(2050)           # {'mean_recovery': .., 'share_target': .., ...}
    sim.year_reached(0.8)        # 2D масив: рік, коли піксель досягне 80% (карта «коли відросте»)
"""
import json
from pathlib import Path

import numpy as np

from .core import STAGE_NAMES, predict_arrays

_PATH = Path(__file__).parent / "growth.json"
_G = None

CLASS_MID_M = (2.5, 7.5, 15.0)        # середини класів 0-5, 5-10, >10 м (для очікуваної висоти)
STAGE_EDGES_M = (5.0, 10.0)
TAU_MIN, TAU_MAX = 1.0, 200.0         # межі швидкості, як у моделі 2
R_MIN, R_MAX = 0.02, 0.97             # поточний стан пікселя обрізаємо, щоб tau було скінченним
DEFAULT_TARGET = 0.8
VALIDATED_COUNTRIES = ("canada",)     # крива підтверджена лише тут (див. growth_info)


def _params():
    global _G
    if _G is None:
        _G = json.loads(_PATH.read_text())
    return _G


_NO_CURVE = {
    "savanna": "У саванах горить майже щорічно: відновлення після однієї пожежі не визначене, крива росту не застосовна.",
    "monsoon": "Для мусонних сухих лісів крива росту ще не підігнана: немає перевірених даних про вік пожеж.",
}


def _growth_region(region):
    from .regions import resolve_model

    return resolve_model(region)


def growth_info(region=None):
    """Метадані кривої: версія, A, tau, на скількох пожежах навчена, діапазон віку, чи пройшла перевірку.
    Крива є лише для регіону continental (підігнана на 49 пожежах Канади). Для mediterranean повертає запис про те,
    чому її не підтверджено, для savanna і monsoon пояснення, чому вона не застосовна (valid=False, reason)."""
    if region is not None:
        r = _growth_region(region)
        if r == "mediterranean":
            return json.loads((Path(__file__).parent / "growth_mediterranean.json").read_text())
        if r in _NO_CURVE:
            return dict(region=r, valid=False, reason=_NO_CURVE[r])
    g = _params()
    out = {k: g[k] for k in ("version", "valid", "A", "tau", "n_fires", "age_range", "metrics", "note")}
    out.update(region="continental", fitted_on="Канада (49 пожеж NBAC, вік 9-35 років)", validated_for=list(VALIDATED_COUNTRIES),
               not_transferable_to=["usa", "ukraine"],
               evidence="Вік пояснює відновлення лише в Канаді (Спірмен +0.72), і лише для віку 19-35 років (до ~20 років висота стоїть на ~0.42 "
                        "від довоєнної, далі росте до ~0.8 до 35 років). У США (вік 4-18) і Україні (3-17) залежності від віку немає (Спірмен -0.19 і +0.02); "
                        "крива Канади на них гірша за константу.")
    return out


def expected_height(pred):
    """Очікувана висота (м) з ймовірностей класів виходу predict_arrays / predict_table. NaN там, де пікселі невалідні."""
    p0, p1, p2 = (np.asarray(pred[k], dtype="float64") for k in ("p_0_5", "p_5_10", "p_gt10"))
    return p0 * CLASS_MID_M[0] + p1 * CLASS_MID_M[1] + p2 * CLASS_MID_M[2]


def stage_from_height(height_m):
    """0 = до 5 м, 1 = 5-10 м, 2 = понад 10 м, -1 = немає значення (NaN)."""
    h = np.asarray(height_m, dtype="float64")
    st = np.where(h < STAGE_EDGES_M[0], 0, np.where(h < STAGE_EDGES_M[1], 1, 2)).astype(np.int8)
    return np.where(np.isfinite(h), st, np.int8(-1)).astype(np.int8)


class Growth:
    """Крива відновлення за віком (рівень пожежі) + фабрика симуляцій для пікселів."""

    def __init__(self, A=None, tau=None, region=None, allow_unvalidated=False):
        """region: None або 'continental' (крива за віком, підігнана на Канаді). Для інших регіонів криву дані НЕ підтримують
        (mediterranean: відновлення не залежить від віку 3-20 років; savanna: щорічні пожежі; monsoon: немає даних), тому
        викидається ValueError. allow_unvalidated=True бере канадську криву з попередженням. A і tau можна задати вручну."""
        g = _params()
        self.region = "continental"
        if region is not None:
            self.region = _growth_region(region)
            if self.region != "continental":
                info = growth_info(self.region)
                if not info.get("valid") and A is None and tau is None:
                    if not allow_unvalidated:
                        raise ValueError(f"Крива росту для регіону {self.region!r} не підтверджена даними: {info['reason']} "
                                         "Можна задати A і tau вручну або allow_unvalidated=True (канадська крива, з попередженням).")
                    import warnings
                    warnings.warn(f"Використано канадську криву росту для регіону {self.region!r}: дані її не підтверджують.")
        self.A = float(g["A"] if A is None else A)
        self.tau = float(g["tau"] if tau is None else tau)

    @classmethod
    def for_location(cls, lon, lat, allow_unvalidated=False):
        """Крива для місця за координатами (див. region_for). Поза зонами викидає OutOfDomainError."""
        from .regions import OutOfDomainError, region_for

        info = region_for(lon, lat)
        if not info["in_domain"]:
            raise OutOfDomainError(info["message"])
        if info["model"] == "continental" and info["country"] not in VALIDATED_COUNTRIES:
            if not allow_unvalidated:
                raise ValueError(f"Крива росту підтверджена лише для {list(VALIDATED_COUNTRIES)}, а це {info['country']!r}: на пожежах віком до 18 років "
                                 "вік не пояснює відновлення (див. growth_info()['evidence']). allow_unvalidated=True бере канадську криву з попередженням.")
            import warnings
            warnings.warn(f"Канадська крива росту застосована до {info['country']!r}, де її не підтверджено.")
        return cls(region=info["model"], allow_unvalidated=allow_unvalidated)

    # ----- рівень пожежі -----
    def recovery(self, age):
        """Частка висоти лісу до пожежі (0..A) для віку пожежі в роках. Скаляр або масив; вік < 0 дає 0."""
        a = np.maximum(np.asarray(age, dtype="float64"), 0.0)
        out = self.A * (1.0 - np.exp(-a / self.tau))
        return float(out) if out.ndim == 0 else out

    def curve(self, max_age=70, step=1.0):
        """(ages, recovery) для графіка."""
        ages = np.arange(0.0, max_age + step, step)
        return ages, self.recovery(ages)

    def years_to(self, target=DEFAULT_TARGET):
        """Скільки років від пожежі до досягнення target (0..1). inf, якщо крива до нього не доходить."""
        return float("inf") if target >= self.A else float(-self.tau * np.log(1.0 - target / self.A))

    def years_left(self, age_now, target=DEFAULT_TARGET):
        """Скільки років лишилось до target, якщо пожежі зараз age_now років (не менше 0)."""
        return max(self.years_to(target) - float(age_now), 0.0)

    # ----- піксельна симуляція -----
    def simulate(self, pred=None, *, fire_year, ref_height_m=None, now_year=2026, burned=None,
                 height_m=None, valid=None, calibrate=True):
        """Будує GrowthSimulation.

        pred          dict з predict_arrays (потрібні p_0_5, p_5_10, p_gt10; valid береться звідти).
                      Або передайте height_m (поточна висота, м) і за потреби valid.
        fire_year     рік пожежі. now_year - рік знімків (за замовчуванням 2026).
        ref_height_m  висота лісу до пожежі, м (наприклад, медіана GEDI rh98 сусіднього незгорілого лісу).
                      Якщо не задано, береться 75-й перцентиль висоти поза згарищем (грубо, краще задавати).
        burned        bool-маска згарища тієї ж форми. Не задано = усе згоріло. Поза згарищем ліс завжди на 100%.
        calibrate     True: середнє відновлення згарища зараз збігається з кривою моделі 2 для цього віку.
        """
        if height_m is None:
            if pred is None:
                raise ValueError("Потрібен pred (вихід predict_arrays) або height_m")
            height_m = expected_height(pred)
            if valid is None:
                valid = pred["valid"]
        height_m = np.asarray(height_m, dtype="float64")
        shape = height_m.shape
        valid = np.isfinite(height_m) if valid is None else (np.asarray(valid, dtype=bool) & np.isfinite(height_m))
        burned = np.ones(shape, bool) if burned is None else np.asarray(burned, dtype=bool)
        if burned.shape != shape:
            raise ValueError(f"burned має форму {burned.shape}, а дані {shape}")
        age_now = float(now_year) - float(fire_year)
        if age_now <= 0:
            raise ValueError("now_year має бути пізніше за fire_year")
        if ref_height_m is None:
            out = height_m[valid & ~burned]
            ref_height_m = float(np.nanpercentile(out, 75)) if out.size else float(np.nanpercentile(height_m[valid], 90))
        return GrowthSimulation(self, height_m, valid, burned, float(fire_year), float(now_year), float(ref_height_m), calibrate)

    def simulate_from_signals(self, nisar_HV, nisar_HH, s1_VH, s1_VV, NDVI, **kw):
        """predict_arrays + simulate за один виклик. kw - аргументи simulate (fire_year, ref_height_m, burned, ...)."""
        return self.simulate(predict_arrays(nisar_HV, nisar_HH, s1_VH, s1_VV, NDVI), **kw)

    # ----- таблиці -----
    def add_forecast(self, df, *, fire_year, ref_height_m=None, now_year=2026, years=(), target=DEFAULT_TARGET,
                     burned=None, calibrate=True):
        """Додає до таблиці прогнозу predict_table колонки росту (один рядок = один піксель):
        height_now_m, recovery_now, year_reached (коли досягне target), recovery_<рік> для кожного року з years.
        fire_year, ref_height_m - число або назва колонки; burned - назва колонки з bool (немає = усе згоріло)."""
        import pandas as pd

        col = lambda v: df[v].to_numpy(dtype="float64") if isinstance(v, str) else v
        b = None if burned is None else df[burned].to_numpy(dtype=bool)
        fy = col(fire_year)
        if np.ndim(fy) == 0:
            sim = self.simulate({k: df[k].to_numpy() for k in ("p_0_5", "p_5_10", "p_gt10", "valid")}, fire_year=float(fy),
                                ref_height_m=ref_height_m, now_year=now_year, burned=b, calibrate=calibrate)
            out = pd.DataFrame(index=df.index)
            out["height_now_m"] = sim.height_at(now_year)
            out["recovery_now"] = sim.recovery_at(now_year)
            out[f"year_reached_{int(round(target * 100))}"] = sim.year_reached(target)
            for y in years:
                out[f"recovery_{int(y)}"] = sim.recovery_at(y)
            return df.join(out)
        # різні роки пожеж у таблиці: рахуємо групами
        parts = []
        for y0, idx in df.groupby(fy).groups.items():
            parts.append(self.add_forecast(df.loc[idx], fire_year=float(y0), ref_height_m=ref_height_m, now_year=now_year,
                                           years=years, target=target, burned=burned, calibrate=calibrate))
        return pd.concat(parts).loc[df.index]


class GrowthSimulation:
    """Стан «сьогодні» + швидкість росту кожного пікселя. Усі масиви мають форму вхідних даних."""

    def __init__(self, model, height_m, valid, burned, fire_year, now_year, ref_height_m, calibrate):
        self.model, self.fire_year, self.now_year, self.ref_height_m = model, fire_year, now_year, ref_height_m
        self.age_now = now_year - fire_year
        self.valid, self.burned = valid, burned
        r0 = height_m / ref_height_m
        sel = valid & burned
        self.calibration_scale = 1.0
        if calibrate and sel.any() and np.nanmean(r0[sel]) > 0:
            self.calibration_scale = float(model.recovery(self.age_now) / np.nanmean(r0[sel]))
        r0 = np.clip(r0 * self.calibration_scale, R_MIN, R_MAX)
        self.r0 = np.where(valid, r0, np.nan)                       # відновлення зараз (0..1)
        with np.errstate(invalid="ignore", divide="ignore"):
            tau = -self.age_now / np.log(1.0 - np.minimum(r0, R_MAX) / model.A)
        self.tau = np.where(valid, np.clip(tau, TAU_MIN, TAU_MAX), np.nan)   # швидкість кожного пікселя, роки

    @property
    def shape(self):
        return self.r0.shape

    def recovery_at(self, year):
        """Відновлення (0..1) у заданий рік. До року пожежі і поза згарищем = 1 (ліс на місці); невалідні = NaN."""
        age = float(year) - self.fire_year
        if age < 0:
            r = np.ones(self.shape)
        else:
            r = np.where(self.burned, self.model.A * (1.0 - np.exp(-age / self.tau)), 1.0)
        return np.where(self.valid, r, np.nan).astype("float32")

    def height_at(self, year):
        """Висота (м) = відновлення * висота лісу до пожежі."""
        return (self.recovery_at(year) * self.ref_height_m).astype("float32")

    def stage_at(self, year):
        """Стадія (0/1/2, -1) за висотою у заданий рік, як у predict_arrays."""
        return stage_from_height(self.height_at(year))

    def stage_names(self):
        return list(STAGE_NAMES)

    def stats_at(self, year, target=DEFAULT_TARGET):
        """Зведення по згарищу: середнє відновлення, частка площі, що досягла target, і значення кривої моделі 2."""
        r = self.recovery_at(year)
        sel = self.valid & self.burned
        n = int(sel.sum())
        nb = int(self.burned.sum())      # усе згарище; пікселі без валідних сигналів у цифри не потрапляють (див. excluded_share)
        return dict(year=float(year), age=float(year) - self.fire_year,
                    mean_recovery=float(np.nanmean(r[sel])) if n else float("nan"),
                    share_target=float(np.mean(r[sel] >= target)) if n else float("nan"),
                    model_recovery=self.model.recovery(float(year) - self.fire_year),
                    n_pixels=n, n_burned=nb, excluded_share=float(1 - n / nb) if nb else float("nan"))

    def timeline(self, years, target=DEFAULT_TARGET):
        """Список stats_at для кожного року (для графіка або таблиці)."""
        return [self.stats_at(y, target) for y in years]

    def frames(self, years):
        """Генератор (рік, масив відновлення) - зручно для анімації й експорту кадрів."""
        for y in years:
            yield float(y), self.recovery_at(y)

    def year_reached(self, target=DEFAULT_TARGET):
        """Рік, коли піксель вперше досягне target (0..1). Для вже досягнутих це рік у минулому, inf - ніколи, NaN - невалідні.
        Поза згарищем = рік пожежі (ліс уже на місці)."""
        A = self.model.A
        with np.errstate(invalid="ignore", divide="ignore"):
            if target >= A:
                y = np.full(self.shape, np.inf)
            else:
                y = self.fire_year - self.tau * np.log(1.0 - target / A)
        y = np.where(self.burned, y, self.fire_year)
        return np.where(self.valid, y, np.nan).astype("float32")
