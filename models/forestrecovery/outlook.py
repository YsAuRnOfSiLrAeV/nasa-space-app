"""Текстові рекомендації для місця: що можна сказати про майбутнє лісу після пожежі, без малювання дерев.

    from forestrecovery import outlook
    o = outlook(-120.2, 51.1, fire_year=2003)       # Канада: "через 20 років ≈ 56% висоти сусіднього лісу, 80% близько 2067"
    o = outlook(37.0, 49.5, severity=0.5)           # Україна: "сильна пожежа: рівень ≈ 45%, зелень ≈ 85%"
    o["text"], o["kind"], o["numbers"], o["warnings"]

kind: growth_forecast (Канада: відсотки за роками) | severity_scenario (Україна, Середземномор'я: рівень від сили пожежі) | none_savanna | state_only | outside.
Кожен текст чесно каже, що це (типова траєкторія чи сценарій) і де це екстраполяція. Залежності: лише numpy.
"""
from .growth2 import _in_canada_zone, forecast_recovery
from .regions import OutOfDomainError, region_for
from .scenario import Scenario

T = {
    "uk": {
        "outside": "Прогноз на цю дату не можемо. Це місце поза територією, де ми перевіряли модель. Поки лише знімки на зараз.",
        "need_year": "Канада: прогноз росту підтверджений. Вкажіть рік пожежі, і ми скажемо, на скільки відсотків ліс відновиться через 10, 20 і 30 років.",
        "growth": "Пожежа {fy} року, Канада. Зараз ліс відновлений приблизно на {now}% висоти сусіднього незгорілого лісу. За типовою траєкторією: через 10 років ≈ {y10}%, через 20 ≈ {y20}%, через 30 ≈ {y30}%; 80% буде близько {y80}. Це типова крива за віком пожежі, а не вимір цієї ділянки.",
        "extr": " Частина прогнозу виходить за перевірений вік пожежі (9-35 років), тому це екстраполяція.",
        "scen": "{where}. Висоту лісу тут визначає сила пожежі, а не час. {levels} Зелень (оптика) повертається швидше й завищує відновлення: за 10 років до ≈ {g10}% проти {s}% висоти. Це сценарій рівня, а не прогноз за роками.",
        "scen_sev": "{where}. Для сили пожежі {sev}: очікуваний рівень висоти ≈ {s}% висоти сусіднього лісу (для окремої пожежі від {lo}% до {hi}%), зелень за 10 років ≈ {g10}%. Висоту тут визначає сила пожежі, а не час, тому це сценарій, а не прогноз за роками.",
        "lvl": "Слабка пожежа ≈ {w}%, середня ≈ {m}%, сильна ≈ {st}% висоти сусіднього лісу.",
        "sav": "Савана. Прогнозу за роками немає й відновлювати нічого: за нашими даними крони під час пожеж здебільшого не гинуть (98% точок без втрати крон), зелень не падає, висота від віку не залежить. Оцінка стану (ліс чи відкрита савана) добра: AUC 0.82-0.90 між країнами.",
        "state": "Стан лісу оцінити можна, але прогнозу за роками для цього місця немає: крива росту підтверджена лише для Канади, а сценарій сили пожежі для України й Середземномор'я.",
        "where_ua": "Україна", "where_med": "Середземномор'я ({c})",
    },
    "en": {
        "outside": "We cannot give a forecast for this date. This place is outside the area where the model was validated. For now only current imagery.",
        "need_year": "Canada: the growth forecast is validated. Give the fire year and we will say how much of the forest recovers in 10, 20 and 30 years.",
        "growth": "Fire of {fy}, Canada. The forest has recovered about {now}% of the neighbouring unburned forest height. Along a typical trajectory: in 10 years ≈ {y10}%, in 20 ≈ {y20}%, in 30 ≈ {y30}%; 80% around {y80}. This is a typical curve by fire age, not a measurement of this site.",
        "extr": " Part of the forecast is beyond the validated fire age (9-35 years), so it is extrapolation.",
        "scen": "{where}. Forest height here is set by fire severity, not by time. {levels} Greenness (optics) returns faster and overstates recovery: up to ≈ {g10}% in 10 years versus {s}% of height. This is a level scenario, not a forecast by years.",
        "scen_sev": "{where}. For fire severity {sev}: expected height level ≈ {s}% of the neighbouring forest (for a single fire from {lo}% to {hi}%), greenness in 10 years ≈ {g10}%. Height here is set by severity, not by time, so this is a scenario, not a forecast by years.",
        "lvl": "A weak fire ≈ {w}%, medium ≈ {m}%, strong ≈ {st}% of the neighbouring forest height.",
        "sav": "Savanna. There is no forecast by years and nothing to recover: in our data canopies mostly survive fires (98% of points show no canopy loss), greenness does not drop and height does not depend on fire age. The state estimate (forest vs open savanna) is good: AUC 0.82-0.90 across countries.",
        "state": "The forest state can be assessed, but there is no forecast by years for this place: the growth curve is validated only for Canada, and the severity scenario for Ukraine and the Mediterranean.",
        "where_ua": "Ukraine", "where_med": "Mediterranean ({c})",
    },
}
COUNTRY = {"uk": {"spain": "Іспанія", "greece": "Греція", "turkey": "Туреччина"}, "en": {"spain": "Spain", "greece": "Greece", "turkey": "Turkey"}}


def _pct(x, cap=None):
    v = 100 * float(x)
    return int(round(min(v, cap) if cap else v))


def outlook(lon, lat, fire_year=None, severity=None, covariates=None, now_year=2026, lang="uk"):
    """Текст і числа про майбутнє лісу для місця. fire_year потрібен для Канади, severity (0..1) необов'язкова для сценарію (без неї дається слабка/середня/сильна)."""
    t = T[lang]
    info = region_for(lon, lat)
    if not info["in_domain"]:
        return dict(kind="outside", available=False, text=t["outside"], numbers={}, warnings=["OUT_OF_DOMAIN"], region=None)
    region, country = info["region"], info["country"]
    base = dict(region=region, country=country, tier=info.get("tier", 1))
    if region == "continental" and _in_canada_zone(lon, lat):
        if fire_year is None:
            return dict(kind="growth_forecast", available=True, text=t["need_year"], numbers={}, warnings=["NEED_FIRE_YEAR"], **base)
        f = forecast_recovery(fire_year, covariates, horizon=40, now_year=now_year, lon=lon, lat=lat)
        at = lambda n: _pct(f["recovery"][min(len(f["recovery"]) - 1, int(now_year - fire_year) + n)])
        nums = dict(now=_pct(f["now_recovery"]), in10=at(10), in20=at(20), in30=at(30), year_80pct=f["year_80pct"], tau=f["tau"])
        txt = t["growth"].format(fy=fire_year, now=nums["now"], y10=nums["in10"], y20=nums["in20"], y30=nums["in30"], y80=nums["year_80pct"])
        ex = any(w.startswith("FORECAST_EXTRAPOLATES") or w == "AGE_BELOW_VALIDATED" for w in f["warnings"])
        return dict(kind="growth_forecast", available=True, text=txt + (t["extr"] if ex else ""), numbers=nums, warnings=f["warnings"], **base)
    sc = None
    if region == "mediterranean":
        sc = Scenario("mediterranean", country=country if country in ("spain", "greece", "turkey") else None)
        where = t["where_med"].format(c=COUNTRY[lang].get(country, country))
    elif region == "continental" and country == "ukraine":
        sc = Scenario("continental")
        where = t["where_ua"]
    if sc is not None:
        lv = sc.severity_levels()
        s_weak, s_med, s_strong = (_pct(sc.structure_level(lv[k])["mean"], cap=100) for k in ("weak", "medium", "strong"))
        g10 = lambda v: _pct(sc.greenness(v, years=[10])[0])
        if severity is None:
            s_mid = sc.structure_level(lv["strong"])
            nums = dict(weak=s_weak, medium=s_med, strong=s_strong, greenness_strong_10y=g10(lv["strong"]))
            txt = t["scen"].format(where=where, levels=t["lvl"].format(w=s_weak, m=s_med, st=s_strong), g10=nums["greenness_strong_10y"], s=s_strong)
        else:
            st = sc.structure_level(severity)
            nums = dict(level=_pct(st["mean"], cap=100), lo=_pct(st["lo"], cap=100), hi=_pct(st["hi"], cap=100), greenness_10y=g10(severity))
            txt = t["scen_sev"].format(where=where, sev=f"{float(severity):.2f}", s=nums["level"], lo=nums["lo"], hi=nums["hi"], g10=nums["greenness_10y"])
        return dict(kind="severity_scenario", available=True, text=txt, numbers=nums, warnings=["SCENARIO_NOT_TIME_FORECAST"], **base)
    if region == "savanna":
        return dict(kind="none_savanna", available=False, text=t["sav"], numbers={}, warnings=["NO_REGROWTH_PROCESS"], **base)
    return dict(kind="state_only", available=False, text=t["state"], numbers={}, warnings=["NO_FORECAST_FOR_REGION"], **base)
