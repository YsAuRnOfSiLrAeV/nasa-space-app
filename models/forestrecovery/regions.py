"""Регіони: яка модель для якого місця і наскільки їй можна вірити.

Регіон = клімат/тип лісу з трьома країнами (без змішування між регіонами): continental, mediterranean, savanna, monsoon.
Кожен регіон має власну модель, навчену лише на його країнах (models/<регіон>.json). Модель вважається ПЕРЕВІРЕНОЮ лише
поблизу наших точок ("слід": комірки 0.5 x 0.5 градуса із сусідніми); поза слідом це out_of_domain.
Залежності: лише numpy. Дані: regions.json (пише scripts/build_regions.py).

    from forestrecovery import region_for
    region_for(31.4, 36.9)    # Манавгат, Туреччина -> mediterranean, moderate, AUC
    region_for(-60, -3)       # Амазонія -> out_of_domain
"""
import json
from pathlib import Path

import numpy as np

_PATH = Path(__file__).parent / "regions.json"
_R = None
_CACHE = {}
_GRID = None

# старі назви: boreal було моделлю Канади, тепер Канада належить регіону continental
LEGACY_ALIASES = {"boreal": "continental", "default": "continental", "canada": "continental", "ukraine": "continental"}
RELIABILITY_TEXT = {
    "good": "перевірено, AUC 0.70 і вище",
    "moderate": "перевірено, AUC 0.62-0.70: використовувати з обережністю",
    "low": "перевірено, AUC нижче 0.62: майже не відрізняється від випадкового",
    "out_of_domain": "поза областю застосування: у цьому місці ми модель не перевіряли",
}


class OutOfDomainError(ValueError):
    """Координати поза слідом, де модель перевірено."""


def _regions():
    global _R
    if _R is None:
        _R = json.loads(_PATH.read_text(encoding="utf-8"))
    return _R


def list_regions():
    """Регіони, країни, результати перевірки і сліди (dict з regions.json)."""
    return _regions()


def resolve_model(name):
    """Назва регіону або країни -> назва моделі: 'greece' -> 'mediterranean', 'canada' -> 'continental'.
    Старі назви ('boreal') теж працюють. ValueError для невідомої."""
    key = str(name).lower()
    R = _regions()["regions"]
    if key in R:
        return key
    for rid, r in R.items():
        if key in r["planned_countries"]:
            return rid
    if key in LEGACY_ALIASES:
        return LEGACY_ALIASES[key]
    known = sorted(set(R) | {c for r in R.values() for c in r["planned_countries"]} | set(LEGACY_ALIASES))
    raise ValueError(f"Невідома модель/регіон {name!r}. Є: {known} або 'auto' (з lon/lat)")


def _grid():
    """Сітка території (регіони й країни), якщо її зібрав scripts/build_territory.py; інакше None (тоді працюють комірки сліду)."""
    global _GRID
    if _GRID is None:
        p = Path(__file__).parent / "territory_grid.npz"
        if p.exists():
            z = np.load(p, allow_pickle=False)
            _GRID = dict(region=z["region"], country=z["country"], tier=(z["tier"] if "tier" in z.files else None), meta=json.loads(str(z["meta"])))
        else:
            _GRID = False
    return _GRID or None


def grid_lookup(lon, lat):
    """Індекси регіону й країни в сітці для координат (0 = поза територією). Скаляри або масиви."""
    g = _grid()
    m = g["meta"]
    lon, lat = np.asarray(lon, dtype="float64"), np.asarray(lat, dtype="float64")
    col = np.floor((lon - m["west"]) / m["res"]).astype(np.int64)
    row = np.floor((m["north"] - lat) / m["res"]).astype(np.int64)
    h, w = g["region"].shape
    ok = (col >= 0) & (col < w) & (row >= 0) & (row < h)
    col, row = np.clip(col, 0, w - 1), np.clip(row, 0, h - 1)
    return np.where(ok, g["region"][row, col], 0), np.where(ok, g["country"][row, col], 0)


def tier_lookup(lon, lat):
    """Рівень території в точці: 1 = перевірено (екорегіони наших країн), 2 = поширено на той самий тип лісу, 0 = поза територією."""
    g = _grid()
    r, _ = grid_lookup(lon, lat)
    if g["tier"] is None:
        return np.where(r > 0, 1, 0)
    m = g["meta"]
    col = np.floor((np.asarray(lon, dtype="float64") - m["west"]) / m["res"]).astype(np.int64)
    row = np.floor((m["north"] - np.asarray(lat, dtype="float64")) / m["res"]).astype(np.int64)
    h, w = g["tier"].shape
    ok = (col >= 0) & (col < w) & (row >= 0) & (row < h)
    return np.where(ok, g["tier"][np.clip(row, 0, h - 1), np.clip(col, 0, w - 1)], 0)


_REL_ORDER = {"good": 2, "moderate": 1, "low": 0}


def _lookup():
    """Таблиці для швидкої перевірки: код комірки -> (регіон, країна); окремо точні комірки й комірки з сусідами."""
    if "lookup" not in _CACHE:
        R = _regions()
        step = 10000
        exact, near = {}, {}
        for rid, countries in R["footprints"].items():
            for cid, cells in countries.items():
                for i, j in cells:
                    exact.setdefault((i + 5000) * step + (j + 5000), (rid, cid))
        for rid, countries in R["footprints"].items():
            for cid, cells in countries.items():
                for i, j in cells:
                    for di in (-1, 0, 1):
                        for dj in (-1, 0, 1):
                            near.setdefault((i + di + 5000) * step + (j + dj + 5000), (rid, cid))
        _CACHE["lookup"] = (step, exact, near, R["cell_deg"])
    return _CACHE["lookup"]


def _codes(lon, lat):
    step, _, _, cell = _lookup()
    i = np.floor(np.asarray(lon, dtype="float64") / cell).astype(np.int64)
    j = np.floor(np.asarray(lat, dtype="float64") / cell).astype(np.int64)
    return (i + 5000) * step + (j + 5000)


def route(lon, lat):
    """Яку модель брати для координат (скаляри або масиви): масив назв регіонів, '' = поза слідом."""
    if _grid():
        r, _ = grid_lookup(lon, lat)
        return np.array([""] + _grid()["meta"]["regions"], dtype="<U16")[r]
    _, _, near, _ = _lookup()
    codes = _codes(lon, lat)
    out = np.full(codes.shape, "", dtype="<U16")
    for code in np.unique(codes):
        hit = near.get(int(code))
        if hit:
            out[codes == code] = hit[0]
    return out


def region_for(lon, lat):
    """Детально для однієї точки: регіон/модель, країна, надійність і пояснення.

    Повертає dict: in_domain, model (або None), region, country, reliability (good / moderate / low / out_of_domain),
    validated (запис про перевірку цієї країни або None), message (готовий текст для підпису)."""
    if _grid():
        return _region_for_grid(float(lon), float(lat))
    _, exact, near, _ = _lookup()
    code = int(_codes(float(lon), float(lat)))
    hit = exact.get(code) or near.get(code)
    if not hit:
        return dict(in_domain=False, model=None, region=None, country=None, reliability="out_of_domain", validated=None,
                    message=RELIABILITY_TEXT["out_of_domain"])
    rid, cid = hit
    reg = _regions()["regions"][rid]
    val = next(c for c in reg["countries"] if c["id"] == cid)
    ev = val.get("loco")
    if ev:
        trained = ", ".join(next(c["name_en"] for c in reg["countries"] if c["id"] == k) for k in val["loco_trained_on"])
        msg = (f"{val['name_en']} ({reg['name_en']}): AUC {ev['auc']:.2f} [{ev['lo']:.2f}-{ev['hi']:.2f}] для моделі, навченої без цієї країни "
               f"(на {trained}); {RELIABILITY_TEXT[val['reliability']]}.")
    else:
        ce = val["ceiling"]
        msg = f"{val['name_en']} ({reg['name_en']}): AUC {ce['auc']:.2f} усередині країни; {RELIABILITY_TEXT[val['reliability']]}."
    return dict(in_domain=True, model=rid, region=rid, country=cid, reliability=val["reliability"], validated=val, message=msg)


def _region_for_grid(lon, lat):
    g = _grid()
    m = g["meta"]
    r, c = grid_lookup(lon, lat)
    ri, ci = int(r), int(c)
    if ri == 0:
        return dict(in_domain=False, model=None, region=None, country=None, reliability="out_of_domain", validated=None,
                    message=RELIABILITY_TEXT["out_of_domain"])
    rid = m["regions"][ri - 1]
    cname = m["countries"][ci - 1] if ci > 0 else ""
    cid = m["trained"].get(cname)
    reg = _regions()["regions"][rid]
    val = next((x for x in reg["countries"] if x["id"] == cid), None) if cid else None
    if val:
        ev, ce = val.get("loco"), val["ceiling"]
        if ev:
            trained = ", ".join(next(x["name_en"] for x in reg["countries"] if x["id"] == k) for k in val["loco_trained_on"])
            msg = (f"{val['name_en']} ({reg['name_en']}): AUC {ev['auc']:.2f} [{ev['lo']:.2f}-{ev['hi']:.2f}] для моделі, навченої без цієї країни "
                   f"(на {trained}); {RELIABILITY_TEXT[val['reliability']]}.")
        else:
            msg = f"{val['name_en']} ({reg['name_en']}): AUC {ce['auc']:.2f} усередині країни; {RELIABILITY_TEXT[val['reliability']]}."
        return dict(in_domain=True, model=rid, region=rid, country=cid, reliability=val["reliability"], validated=val, extrapolated=False, tier=1, message=msg)
    rel = min((x["reliability"] for x in reg["countries"]), key=lambda k: _REL_ORDER[k]) if reg["countries"] else "low"
    ext = int(tier_lookup(lon, lat)) == 2
    msg = (f"{cname or 'Ця територія'} ({reg['name_en']}): країна не входила до навчання, але це той самий тип лісу (екорегіон), що й у регіоні; "
           f"надійність береться як у найгіршої перевіреної країни регіону: {RELIABILITY_TEXT[rel]}.")
    if ext:
        msg += " Рівень B: екорегіон поза навчальною вибіркою, лише поширення моделі на той самий тип лісу."
    return dict(in_domain=True, model=rid, region=rid, country=(cname or "unknown").lower(), reliability=rel, validated=None, extrapolated=True, tier=(2 if ext else 1), message=msg)


def accuracy(region="continental"):
    """Похибка моделі проти лідара GEDI для регіону (з перевірки поза вибіркою): dict або None, якщо регіон не перевірявся в метрах.
    fire_level.error_vs_lidar_pct_median: типова помилка середнього по пожежі, % висоти сусіднього лісу; point_level.mae_m: помилка однієї клітинки, м."""
    p = Path(__file__).parent / "accuracy.json"
    return json.loads(p.read_text(encoding="utf-8")).get(resolve_model(region)) if p.exists() else None


def footprint_geojson(region=None):
    """Де ми дивились: комірки сліду як GeoJSON (для шару на карті). region - необов'язковий фільтр."""
    R = _regions()
    cell = R["cell_deg"]
    feats = []
    for rid, countries in R["footprints"].items():
        if region and resolve_model(region) != rid:
            continue
        reg = R["regions"][rid]
        for cid, cells in countries.items():
            val = next(c for c in reg["countries"] if c["id"] == cid)
            for i, j in cells:
                w, s = i * cell, j * cell
                feats.append(dict(type="Feature", properties=dict(region=rid, country=cid, reliability=val["reliability"]),
                                  geometry=dict(type="Polygon", coordinates=[[[w, s], [w + cell, s], [w + cell, s + cell], [w, s + cell], [w, s]]])))
    return dict(type="FeatureCollection", features=feats)
