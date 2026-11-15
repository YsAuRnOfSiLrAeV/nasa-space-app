"""Ядро бібліотеки: стадія відновлення лісу за сигналами NISAR / Sentinel-1 / NDVI.

Залежності: лише numpy (pandas потрібен тільки для predict_table).
Модель - логістична регресія, коефіцієнти лежать у models/<регіон>.json. Регіони (кожен зі своїми трьома країнами, без змішування):
continental, mediterranean, savanna, monsoon (є ті, для яких зібрано дані). За замовчуванням continental (колишня boreal, Канада +).
region="auto" разом із lon/lat сам вибирає модель за координатами і перевіряє, що місце було у нашій перевірці (див. regions.py).
"""
import json
from pathlib import Path

import numpy as np

from .regions import OutOfDomainError, resolve_model, route

_DIR = Path(__file__).parent
_MODELS = {}

STAGE_NAMES = ["0-5 м (підріст)", "5-10 м", ">10 м (ліс)"]
OUT_COLUMNS = ["valid", "stage", "stage_name", "p_0_5", "p_5_10", "p_gt10", "p_forest_gt5"]
_RAW = ("nisar_HV", "nisar_HH", "s1_VH", "s1_VV", "NDVI")


def model_info(region="continental"):
    """Метадані моделі: версія, дата навчання, діапазони входів, на чому навчено."""
    m = _model(resolve_model(region))
    return {k: m.get(k) for k in ("version", "trained", "raw_inputs", "ranges", "classes", "trained_on", "region", "description")}


def _model(name="continental"):
    if name not in _MODELS:
        path = _DIR / "models" / f"{name}.json"
        if not path.exists():
            raise ValueError(f"Для регіону {name!r} моделі ще немає (є: {sorted(p.stem for p in (_DIR / 'models').glob('*.json'))})")
        m = json.loads(path.read_text())
        for k in ("scaler_mean", "scaler_scale", "coef", "intercept"):
            m[k] = np.asarray(m[k], dtype="float64")
        _MODELS[name] = m
    return _MODELS[name]


def to_db(linear_power):
    """Лінійна потужність (як у NISAR GCOV) у dB. Усереднювати треба ДО переведення в dB."""
    with np.errstate(divide="ignore", invalid="ignore"):
        return 10.0 * np.log10(np.where(np.asarray(linear_power) > 0, linear_power, np.nan))


def _predict_core(name, a):
    """Модель name на словнику масивів a (однакова форма)."""
    m = _model(name)
    shape = a["NDVI"].shape
    valid = np.ones(shape, dtype=bool)
    for k, v in a.items():
        lo, hi = m["ranges"][k]
        valid &= np.isfinite(v) & (v >= lo) & (v <= hi)

    feat = {**a, "nisar_HVmHH": a["nisar_HV"] - a["nisar_HH"], "s1_VHmVV": a["s1_VH"] - a["s1_VV"]}
    X = np.stack([feat[f] for f in m["features"]], axis=-1)[valid]    # [n_valid, n_features]
    Z = (X - m["scaler_mean"]) / m["scaler_scale"]
    with np.errstate(all="ignore"):          # Z скінченна (маска valid вище); numpy 2.x на macOS (Accelerate) іноді видає хибні попередження в matmul
        logits = Z @ m["coef"].T + m["intercept"]
    logits -= logits.max(axis=1, keepdims=True)
    P = np.exp(logits)
    P /= P.sum(axis=1, keepdims=True)

    out = {"valid": valid}
    stage = np.full(shape, -1, dtype=np.int8)
    stage[valid] = P.argmax(axis=1)
    out["stage"] = stage
    for i, key in enumerate(m["class_keys"]):
        arr = np.full(shape, np.nan, dtype=np.float32)
        arr[valid] = P[:, i]
        out[key] = arr
    pf = np.full(shape, np.nan, dtype=np.float32)
    pf[valid] = P[:, 1] + P[:, 2]
    out["p_forest_gt5"] = pf
    return out


def predict_arrays(nisar_HV, nisar_HH, s1_VH, s1_VV, NDVI, region="continental", lon=None, lat=None,
                   on_out_of_domain="raise", **_ignored):
    """Основна функція. Вхід - масиви numpy ОДНАКОВОЇ форми (піксель, рядок, 2D растр - що завгодно),
    значення в dB (NDVI від 0 до 1). Зайві аргументи ігноруються.

    region   регіон-модель: 'continental' (за замовчуванням), 'mediterranean', ... Приймає й назву країни ('greece' -> mediterranean)
             та стару назву 'boreal'. 'auto': модель обирається за lon/lat (скаляри або масиви тієї ж форми, що й растр),
             і лише там, де ми перевіряли (слід).
    on_out_of_domain  лише для 'auto': що робити з координатами поза зонами: 'raise' (OutOfDomainError) або 'nan'
             (ті пікселі стають невалідними: valid=False, stage=-1, NaN).

    Повертає dict масивів тієї самої форми:
      valid        bool   - чи вхід у допустимих межах моделі (інакше решта = NaN / -1)
      stage        int8   - 0 = до 5 м, 1 = 5-10 м, 2 = понад 10 м, -1 = невалідний піксель
      p_0_5, p_5_10, p_gt10  float32 - ймовірності класів
      p_forest_gt5 float32 - ймовірність, що висота понад 5 м (p_5_10 + p_gt10), найнадійніше число
    """
    raw = dict(nisar_HV=nisar_HV, nisar_HH=nisar_HH, s1_VH=s1_VH, s1_VV=s1_VV, NDVI=NDVI)
    a = {k: np.asarray(v, dtype="float64") for k, v in raw.items()}
    shape = np.broadcast(*a.values()).shape
    a = {k: np.broadcast_to(v, shape) for k, v in a.items()}

    if str(region).lower() != "auto":
        return _predict_core(resolve_model(region), a)

    if lon is None or lat is None:
        raise ValueError("region='auto' потребує lon і lat (скаляри або масиви тієї ж форми, що й растр)")
    names = np.broadcast_to(route(lon, lat), shape)
    outside = names == ""
    if outside.any() and on_out_of_domain == "raise":
        raise OutOfDomainError(f"{int(outside.sum())} із {outside.size} пікселів поза областю застосування (немає моделі для цього "
                               "регіону). Передайте on_out_of_domain='nan', щоб позначити їх невалідними.")
    res = {"valid": np.zeros(shape, bool), "stage": np.full(shape, -1, np.int8)}
    for key in ("p_0_5", "p_5_10", "p_gt10", "p_forest_gt5"):
        res[key] = np.full(shape, np.nan, np.float32)
    for name in np.unique(names[~outside]):
        mask = names == name
        sub = _predict_core(str(name), {k: v[mask] for k, v in a.items()})
        for key in res:
            res[key][mask] = sub[key]
    return res


def predict_table(df, region="continental", lon=None, lat=None):
    """Те саме для таблиці pandas (один рядок = один піксель). Індекс зберігається.
    Обов'язкові колонки: nisar_HV, nisar_HH, s1_VH, s1_VV, NDVI. Інші колонки ігноруються.
    region='auto': координати беруться з аргументів lon/lat або з колонок 'longitude'/'latitude'; у вихід додається колонка
    'model' (яку модель використано). Рядки поза зонами стають невалідними."""
    import pandas as pd

    need = list(_RAW)
    missing = [c for c in need if c not in df.columns]
    if missing:
        raise ValueError(f"Бракує колонок: {missing}. Потрібні: {need} (значення в dB, NDVI 0..1)")
    kw = {}
    auto = str(region).lower() == "auto"
    if auto:
        lon = df["longitude"].to_numpy(float) if lon is None and "longitude" in df.columns else lon
        lat = df["latitude"].to_numpy(float) if lat is None and "latitude" in df.columns else lat
        kw = dict(lon=lon, lat=lat, on_out_of_domain="nan")
    r = predict_arrays(*[df[c].to_numpy(dtype="float64") for c in _RAW], region=region, **kw)
    out = pd.DataFrame({k: r[k] for k in ("valid", "stage", "p_0_5", "p_5_10", "p_gt10", "p_forest_gt5")}, index=df.index)
    out["stage_name"] = pd.Series(out.stage.map(dict(enumerate(STAGE_NAMES))), dtype="object").fillna("")
    cols = list(OUT_COLUMNS)
    if auto:
        out["model"] = route(lon, lat)
        cols.append("model")
    return out[cols]


def make_dummy(n=1000, seed=0):
    """Правдоподібна фальшива таблиця пікселів, щоб команда UI могла працювати, не чекаючи на справжні дані."""
    rng = np.random.default_rng(seed)
    import pandas as pd

    hv = rng.normal(-13, 3.5, n).clip(-23, -7.5)
    return pd.DataFrame(dict(
        nisar_HV=hv, nisar_HH=hv + rng.normal(6, 2, n).clip(1, 12),
        s1_VH=rng.normal(-16, 2, n).clip(-19, -11.6), s1_VV=rng.normal(-10, 1.5, n).clip(-13, -6.7),
        NDVI=rng.uniform(0.3, 0.9, n)))
