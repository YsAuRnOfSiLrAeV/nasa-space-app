"""Територія: чи лежить полігон пожежі всередині регіону, де модель перевірена (правило: щонайменше 80% полігона).

Сценарій для інтерфейсу:
    1. користувач малює або вставляє полігон пожежі (GeoJSON) і вибирає дату;
    2. a = assess_territory(polygon):
       - a["status"] == "inside": стан лісу можна оцінити моделлю регіону a["region"]; a["forecast"] каже, чи є прогноз
         для цього місця (a["ask_forecast"]), і з якою застереженням;
       - a["status"] == "outside": лише знімки "на зараз", текст a["message"]: "Прогноз ... переоберіть територію".
    3. territory_geojson() малює регіони різними кольорами (там, де ми дивились).
Залежності: лише numpy. Полігон: GeoJSON (Feature, FeatureCollection, Polygon, MultiPolygon) або список кілець [[lon, lat], ...].
"""
import numpy as np

import json
from pathlib import Path

from .regions import _grid, _lookup, _regions, footprint_geojson, grid_lookup, resolve_model, tier_lookup

MIN_INSIDE = 0.8          # частка полігона, що має лежати в одному регіоні
REGION_COLORS = {"continental": "#2a9d8f", "mediterranean": "#e76f51", "savanna": "#e9c46a", "monsoon": "#9b5de5"}   # різні кольори регіонів

TEXT = {
    "uk": {
        "outside": "Прогноз на цю дату не можемо. Переоберіть територію так, щоб щонайменше {pct}% полігона лежало всередині підсвіченого регіону "
                   "(там, де ми перевіряли модель). Поки показуємо лише знімки на зараз.",
        "inside": "Полігон на {frac}% лежить у регіоні «{region}» (основна країна: {country}). Оцінка стану можлива, надійність: {rel}.",
        "inside_extra": "Полігон на {frac}% лежить у регіоні «{region}», країна: {country} (в навчання не входила, але це той самий тип лісу). Оцінка стану можлива, надійність береться як у найгіршої перевіреної країни регіону: {rel}.",
        "ask": "Хочете прогноз для цієї ділянки?",
        "no_forecast": "Прогноз для цієї ділянки недоступний: {why}",
    },
    "en": {
        "outside": "We cannot give a forecast for this date. Please choose an area so that at least {pct}% of the polygon lies inside a highlighted "
                   "region (where the model was validated). For now we only show current imagery.",
        "inside": "{frac}% of the polygon lies in the \"{region}\" region (main country: {country}). The state can be assessed; reliability: {rel}.",
        "inside_extra": "{frac}% of the polygon lies in the \"{region}\" region, country: {country} (not part of training, but the same forest type). The state can be assessed; reliability is taken from the weakest validated country of the region: {rel}.",
        "ask": "Do you want a forecast for this area?",
        "no_forecast": "A forecast is not available for this area: {why}",
    },
}
REL_TEXT = {"uk": {"good": "добра (AUC 0.70+)", "moderate": "помірна (AUC 0.62-0.70)", "low": "низька (AUC нижче 0.62)"},
            "en": {"good": "good (AUC 0.70+)", "moderate": "moderate (AUC 0.62-0.70)", "low": "low (AUC below 0.62)"}}


def _polygons(g):
    """GeoJSON або кільця -> список полігонів; полігон = список кілець (масиви N x 2, lon/lat)."""
    if isinstance(g, dict):
        t = g.get("type")
        if t == "FeatureCollection":
            return [p for f in g["features"] for p in _polygons(f)]
        if t == "Feature":
            return _polygons(g["geometry"])
        if t == "Polygon":
            return [[np.asarray(r, dtype="float64")[:, :2] for r in g["coordinates"]]]
        if t == "MultiPolygon":
            return [[np.asarray(r, dtype="float64")[:, :2] for r in p] for p in g["coordinates"]]
        raise ValueError(f"Невідомий тип геометрії {t!r}: потрібен Polygon, MultiPolygon, Feature або FeatureCollection")
    a = np.asarray(g, dtype="float64")
    if a.ndim == 2 and a.shape[1] >= 2:
        return [[a[:, :2]]]
    if a.ndim == 3:
        return [[r[:, :2] for r in a]]
    raise ValueError("Полігон має бути GeoJSON або списком точок [[lon, lat], ...]")


def _inside(px, py, rings):
    """Правило парності (дірки враховуються): точки px, py всередині полігона з кільцями rings."""
    ins = np.zeros(px.shape, dtype=bool)
    for r in rings:
        x, y = r[:, 0], r[:, 1]
        x2, y2 = np.roll(x, -1), np.roll(y, -1)
        for xi, yi, xj, yj in zip(x, y, x2, y2):
            if yi == yj:
                continue
            cond = (yi > py) != (yj > py)
            xint = (xj - xi) * (py - yi) / (yj - yi) + xi
            ins ^= cond & (px < xint)
    return ins


def sample_points(polygon, n=60):
    """Рівномірна сітка точок усередині полігона (lon, lat). Для крихітних полігонів сітка згущується; крайній випадок це центроїд."""
    lons, lats = [], []
    for rings in _polygons(polygon):
        outer = rings[0]
        w, e, s, nn = outer[:, 0].min(), outer[:, 0].max(), outer[:, 1].min(), outer[:, 1].max()
        for k in range(4):
            m = n * 2 ** k
            gx = np.linspace(w, e, m + 2)[1:-1]
            gy = np.linspace(s, nn, m + 2)[1:-1]
            X, Y = np.meshgrid(gx, gy)
            X, Y = X.ravel(), Y.ravel()
            ok = _inside(X, Y, rings)
            if ok.sum() >= 20 or k == 3:
                break
        if ok.any():
            lons.append(X[ok]); lats.append(Y[ok])
        else:
            lons.append(np.array([outer[:, 0].mean()])); lats.append(np.array([outer[:, 1].mean()]))
    return np.concatenate(lons), np.concatenate(lats)


def _classify(lon, lat):
    """Для кожної точки: назва регіону ('' = поза територією) і країни (id навченої або назва англійською малими)."""
    g = _grid()
    if g:
        m = g["meta"]
        r, c = grid_lookup(lon, lat)
        regs = np.array([""] + m["regions"], dtype=object)[r]
        cn = np.array([""] + [m["trained"].get(n, n.lower()) for n in m["countries"]], dtype=object)[c]
        return regs, cn
    step, exact, near, cell = _lookup()
    code = (np.floor(lon / cell).astype(np.int64) + 5000) * step + (np.floor(lat / cell).astype(np.int64) + 5000)
    regs, cn = np.full(len(code), "", dtype=object), np.full(len(code), "", dtype=object)
    for c in np.unique(code):
        hit = exact.get(int(c)) or near.get(int(c))
        if hit:
            regs[code == c], cn[code == c] = hit
    return regs, cn


def coverage(polygon):
    """Яка частка полігона лежить у територіях регіонів.

    Повертає dict: n_samples, fractions {регіон: частка 0..1}, best_region (або None), best_fraction, countries {країна: частка},
    countries_by_region {регіон: {країна: частка від усього полігона}} (країна = id навченої або назва країни)."""
    lon, lat = sample_points(polygon)
    n = len(lon)
    regs, cn = _classify(lon, lat)
    by_region, by_country, by_rc = {}, {}, {}
    for rr, cc in zip(regs, cn):
        if rr:
            by_region[rr] = by_region.get(rr, 0) + 1
            by_country[cc] = by_country.get(cc, 0) + 1
            by_rc.setdefault(rr, {})
            by_rc[rr][cc] = by_rc[rr].get(cc, 0) + 1
    fr = {r: v / n for r, v in by_region.items()}
    best = max(fr, key=fr.get) if fr else None
    return dict(n_samples=int(n), fractions=fr, best_region=best, best_fraction=float(fr[best]) if best else 0.0,
                countries={c: v / n for c, v in by_country.items()}, countries_by_region={r: {c: v / n for c, v in d.items()} for r, d in by_rc.items()})


def forecast_kind(region, country):
    """Який прогноз підтверджений для регіону й країни: dict(kind, available, why).
    continental/Канада: крива росту (Growth); mediterranean: сценарій сили пожежі (Scenario, рівень, не роки); решта: недоступно."""
    if region == "continental" and country == "ukraine":
        return dict(kind="severity_scenario", available=True, why="",
                    caveat="Для України прогнозу висоти за роками немає (вік 3-19 років її не пояснює): показуємо сценарій, як рівень висоти залежить від сили пожежі.")
    if region == "continental" and country == "canada":
        return dict(kind="growth_curve", available=True, why="", caveat="Крива підігнана на канадських пожежах: до ~20 років висота майже не росте, далі росте до ~80% до 35 років.")
    if region == "continental":
        return dict(kind=None, available=False, why="крива росту підтверджена лише для Канади; для цієї країни вік пожежі до 18 років не пояснює відновлення.")
    if region == "mediterranean":
        return dict(kind="severity_scenario", available=True, why="",
                    caveat="Для Середземномор'я прогнозу висоти за роками немає: показуємо сценарій (як рівень залежить від сили пожежі) і реальний хід зелені.")
    return dict(kind=None, available=False, why="для цього типу лісу прогноз за роками не підтверджено.")


def assess_territory(polygon, min_inside=MIN_INSIDE, lang="uk"):
    """Головна перевірка перед оцінкою: чи лежить полігон на >= min_inside у регіоні, де модель перевірена.

    status 'inside':  region, region_name, color, country, fraction, reliability, validated (запис про країну), model (назва моделі),
                      forecast (kind, available, why), ask_forecast (чи питати про прогноз), show='state', message.
    status 'outside': show='imagery_only', message з вимогою переобрати територію, fractions (скільки в яких регіонах)."""
    t = TEXT[lang]
    cov = coverage(polygon)
    if cov["best_region"] is None or cov["best_fraction"] < min_inside:
        return dict(status="outside", show="imagery_only", fraction=cov["best_fraction"], fractions=cov["fractions"], region=None,
                    message=t["outside"].format(pct=int(round(min_inside * 100))), ask_forecast=False)
    rid = cov["best_region"]
    reg = _regions()["regions"][rid]
    pool = cov["countries_by_region"][rid]
    cid = max(pool, key=pool.get)
    val = next((x for x in reg["countries"] if x["id"] == cid), None)          # None: країна не входила до навчання (той самий тип лісу)
    fc = forecast_kind(rid, cid)
    name = reg["name"] if lang == "uk" else reg["name_en"]
    if val:
        rel, cname = val["reliability"], (val["name"] if lang == "uk" else val["name_en"])
    else:
        rel = min((x["reliability"] for x in reg["countries"]), key=lambda k: {"good": 2, "moderate": 1, "low": 0}[k]) if reg["countries"] else "low"
        cname = cid.title()
    msg = t["inside" if val else "inside_extra"].format(frac=int(round(cov["best_fraction"] * 100)), region=name, country=cname, rel=REL_TEXT[lang][rel])
    msg += " " + (t["ask"] if fc["available"] else t["no_forecast"].format(why=fc["why"]))
    ext_share = 0.0
    if _grid():
        lo, la = sample_points(polygon)
        r_, _ = grid_lookup(lo, la)
        t_ = tier_lookup(lo, la)
        ext_share = float(np.mean(t_ == 2)) if len(lo) else 0.0
    if ext_share > 0.5:
        msg += (" Більша частина полігона в рівні B (поширено, не перевірено напряму)." if lang == "uk" else
                " Most of the polygon is in tier B (extended, not directly validated).")
    return dict(status="inside", show="state", extended_share=ext_share, region=rid, region_name=name, color=REGION_COLORS.get(rid), country=cid, fraction=cov["best_fraction"],
                fractions=cov["fractions"], reliability=rel, validated=val, extrapolated=val is None, model=reg["model"], forecast=fc,
                ask_forecast=bool(fc["available"]), message=msg)


def growth_zone_geojson():
    """Де крива росту підтверджена (лише Канада, перевірений рівень): контур для інтерфейсу. Поза ним прогноз за роками не показуємо."""
    p = Path(__file__).parent / "growth_zone.geojson"
    return json.loads(p.read_text()) if p.exists() else dict(type="FeatureCollection", features=[])


def scenario_zone_geojson():
    """Де підтверджено сценарій сили пожежі для регіону continental (лише Україна, перевірений рівень). Середземномор'я: див. territory_geojson('mediterranean')."""
    p = Path(__file__).parent / "ukraine_zone.geojson"
    return json.loads(p.read_text()) if p.exists() else dict(type="FeatureCollection", features=[])


def _region_rel(rid):
    reg = _regions()["regions"][rid]
    order = {"good": 2, "moderate": 1, "low": 0}
    return min((x["reliability"] for x in reg["countries"]), key=lambda k: order[k]) if reg["countries"] else "low"


def territory_geojson(region=None):
    """Де модель перевірена або поширюється на той самий тип лісу: контури регіонів з кольором (properties: region, color, name).
    Якщо зібрано сітку території (екорегіони), це спрощені контури регіонів; інакше комірки сліду (з країною й надійністю)."""
    p = Path(__file__).parent / "territory_display.geojson"
    if p.exists() and _grid():
        gj = json.loads(p.read_text())
        regs = _regions()["regions"]
        keep = []
        for f in gj["features"]:
            rid = f["properties"]["region"]
            if region and resolve_model(region) != rid:
                continue
            f["properties"].update(rel=_region_rel(rid), opacity=(0.55 if f["properties"].get("tier", 1) == 1 else 0.25), color=REGION_COLORS.get(rid), name=regs[rid]["name"], name_en=regs[rid]["name_en"])
            keep.append(f)
        gj["features"] = keep
        return gj
    gj = footprint_geojson(region)
    for f in gj["features"]:
        f["properties"]["color"] = REGION_COLORS.get(f["properties"]["region"])
    return gj
