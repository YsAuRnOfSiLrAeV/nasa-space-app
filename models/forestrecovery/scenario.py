"""Сценарій "що якби пожежа була сильнішою чи слабшою" для Середземномор'я (Греція, Туреччина, Іспанія).

ЧЕСНО ПРО ТЕ, ЩО ЦЕ Є: у цьому кліматі висота лісу НЕ залежить від віку пожежі (3-20 років, перевірено трьома способами), тому
траєкторії висоти за роками тут немає. Є два зв'язки, які підтверджують дані:
  - РІВЕНЬ висоти (частка висоти сусіднього незгорілого лісу) залежить від СИЛИ пожежі: слабка ~0.8, сильна ~0.6;
  - ЗЕЛЕНЬ (літній NDVI відносно NDVI до пожежі) відновлюється з часом, швидше після слабкої пожежі (реальні ряди MODIS).
Два графіки разом показують "оптика бреше": зелень повертається за 5-8 років, а висота лишається нижчою за довоєнний ліс.
Зв'язок кореляційний (не причинний), у Греції сила пожежі нічого не пояснює. Залежності: лише numpy. Параметри: scenario_mediterranean.json.

    from forestrecovery import Scenario
    sc = Scenario("mediterranean", country="spain")
    sc.structure_level(0.8)                         # {'mean': 0.5, 'lo': ..., 'hi': ...} частка висоти сусіднього лісу
    sc.greenness(0.8, years=range(1, 16))           # зелень через 1..15 років (до 5 за даними, далі екстраполяція)
    sc.hindcast(fire_year=2000, severity=0.8)       # "пожежа 2000 року: що б ми побачили до 2026"
    sc.what_if(fire_year=2000)                      # слабка / середня / сильна поруч
"""
import json
from pathlib import Path

import numpy as np

from .regions import OutOfDomainError, region_for, resolve_model

_PATHS = {"mediterranean": Path(__file__).parent / "scenario_mediterranean.json", "continental": Path(__file__).parent / "scenario_continental.json"}
_S = {}
Z90 = 1.645


def _params(region="mediterranean"):
    if region not in _S:
        _S[region] = json.loads(_PATHS[region].read_text(encoding="utf-8"))
    return _S[region]


def severity_from_loss(loss_year, fire_year):
    """Сила пожежі = частка точок/пікселів, де Hansen фіксує втрату крон у рік пожежі або наступний. loss_year: масив років втрати
    (Hansen lossyear + 2000, 0 = втрати не було), fire_year: рік пожежі. Повертає число 0..1."""
    ly = np.asarray(loss_year, dtype="float64")
    return float(np.mean((ly >= fire_year) & (ly <= fire_year + 1)))


class Scenario:
    """Сценарії сили пожежі для середземноморського регіону."""

    def __init__(self, region="mediterranean", country=None):
        """country: 'greece' | 'turkey' | 'spain' (власний базовий рівень країни) або None (середній по трьох)."""
        region = resolve_model(region)
        if region not in _PATHS:
            raise ValueError(f"Сценарій сили пожежі є лише для регіонів {sorted(_PATHS)}, а не {region!r}. Для Канади прогноз за роками дає Growth.")
        self.region = region
        if region == "continental":
            if country is None:
                country = "ukraine"
            if str(country).lower() != "ukraine":
                raise ValueError("Для регіону 'continental' сценарій сили пожежі підтверджено лише для України (для Канади прогноз за роками дає Growth, для США сценарію немає).")
        self.p = _params(region)
        st = self.p["structure"]
        if country is not None and str(country).lower() not in st["intercepts"]:
            raise ValueError(f"Невідома країна {country!r}. Є: {sorted(st['intercepts'])}")
        self.country = None if country is None else str(country).lower()
        self.intercept = float(np.mean(list(st["intercepts"].values())) if self.country is None else st["intercepts"][self.country])
        self.slope = float(st["slope"])
        self.slope_ci = [float(x) for x in st["slope_ci"]]
        self.sd = float(st["resid_sd"])

    @classmethod
    def for_location(cls, lon, lat):
        """Сценарій для місця за координатами; поза слідом перевірки або не в середземноморському регіоні OutOfDomainError."""
        info = region_for(lon, lat)
        if not info["in_domain"]:
            raise OutOfDomainError(info["message"])
        if info["model"] == "mediterranean" or (info["model"] == "continental" and info["country"] == "ukraine"):
            return cls(info["model"], country=info["country"])
        raise OutOfDomainError("Сценарій сили пожежі є лише для Середземномор'я й України (для Канади прогноз за роками дає Growth).")

    def severity_levels(self):
        """Типові значення сили пожежі за даними: слабка, середня, сильна (терцилі нашої вибірки)."""
        return dict(self.p["severity"]["typical"])

    # ------------------------------------------------------------ рівень висоти
    def structure_level(self, severity):
        """Очікуваний рівень висоти лісу в згарищі як частка висоти сусіднього незгорілого лісу, для сили пожежі 0..1 (скаляр або масив).
        mean: середнє; lo/hi: 90% інтервал для ОКРЕМОЇ пожежі (розкид між пожежами); mean_lo/mean_hi: інтервал для середнього (за нахилом)."""
        s = np.clip(np.asarray(severity, dtype="float64"), 0.0, 1.0)
        mean = self.intercept + self.slope * s
        edges = np.stack([self.intercept + c * s for c in self.slope_ci])
        out = dict(mean=mean, lo=mean - Z90 * self.sd, hi=mean + Z90 * self.sd, mean_lo=edges.min(0), mean_hi=edges.max(0))
        return {k: (float(np.clip(v, 0, 1.2)) if np.ndim(v) == 0 else np.clip(v, 0, 1.2)) for k, v in out.items()}

    # ------------------------------------------------------------ зелень
    def _green_points(self, severity):
        s = np.clip(np.asarray(severity, dtype="float64"), 0.0, 1.0)
        c = self.p["greenness"]["coef"]
        return [c[f"g{k}"][0] + c[f"g{k}"][1] * s for k in (1, 3, 5)]

    def greenness(self, severity, years=range(1, 16)):
        """Зелень (літній NDVI / NDVI до пожежі) через years років після пожежі (роки >= 1) для сили пожежі 0..1.
        Дані є для 1, 3 і 5 років; решта це експонента, проведена через ці три точки: g(t) = ginf - (ginf - g1) * exp(-(t-1)/tau).
        Повертає масив [len(years)] для скалярної сили або [len(severity), len(years)] для масиву."""
        g1, g3, g5 = self._green_points(severity)
        t = np.asarray(list(years), dtype="float64")
        with np.errstate(divide="ignore", invalid="ignore"):
            r = (g5 - g3) / (g3 - g1)
            ok = (r > 0) & (r < 1)
            ginf = np.where(ok, g1 + (g3 - g1) / (1 - r), g5)
            tau = np.where(ok, -2.0 / np.log(np.where(ok, r, 0.5)), 1.0)
        g = ginf[..., None] - (ginf - g1)[..., None] * np.exp(-(t - 1) / tau[..., None])
        g = np.where(t < 1, np.nan, g)
        return g

    # ------------------------------------------------------------ готові таблиці для графіків
    def compare(self, severity, years=range(1, 16)):
        """Для сили пожежі: зелень за роками (оптика) і рівень висоти (структура, один на всі роки), і розрив між ними."""
        yrs = np.asarray(list(years), dtype="float64")
        g = self.greenness(severity, yrs)
        st = self.structure_level(severity)
        return dict(years=yrs, greenness=g, structure_mean=np.full(yrs.shape, st["mean"]), structure_lo=np.full(yrs.shape, st["lo"]),
                    structure_hi=np.full(yrs.shape, st["hi"]), gap=g - st["mean"], severity=float(severity))

    def hindcast(self, fire_year, severity, until=2026):
        """"Пожежа fire_year із заданою силою: що б ми бачили до року until". Початок: через рік після пожежі (раніше зелень не вимірювалась).
        Повертає dict: year, age, greenness, structure_mean/lo/hi, observed (True для віку 1, 3, 5, решта екстраполяція)."""
        ages = np.arange(1, int(until) - int(fire_year) + 1)
        if len(ages) == 0:
            raise ValueError("until має бути пізніше за fire_year")
        c = self.compare(severity, ages)
        c.update(year=int(fire_year) + ages, age=ages, observed=np.isin(ages, self.p["greenness"]["years_observed"]),
                 note="Висота не залежить від віку (3-20 років): показано рівень, не траєкторію. Зелень після 5 років екстрапольована.")
        return c

    def what_if(self, fire_year=None, severities=None, until=2026, years=range(1, 16)):
        """Слабка / середня / сильна поруч. З fire_year: hindcast до until, без: compare за years. Повертає dict {назва: таблиця}."""
        sev = severities or self.severity_levels()
        return {name: (self.hindcast(fire_year, v, until) if fire_year is not None else self.compare(v, years)) for name, v in sev.items()}

    def info(self):
        """Параметри, обсяг даних і застереження (для підпису в інтерфейсі)."""
        p = self.p
        return dict(country=self.country, structure=p["structure"], greenness=p["greenness"]["coef"], severity=p["severity"], data=p["data"],
                    caveats=p["caveats"])
