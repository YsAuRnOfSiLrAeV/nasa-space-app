"""Специфікація ознак: що подавати на вхід, у яких одиницях, як ми їх рахували, і перевірка входу.

    from forestrecovery import feature_spec, input_report
    feature_spec()                       # dict: входи, одиниці, діапазони, рецепти обчислення (те саме, що FEATURES.md)
    input_report(nisar_HV=hv, nisar_HH=hh, s1_VH=vh, s1_VV=vv, NDVI=ndvi, region="continental")   # чи правильні одиниці й діапазони
Залежності: лише numpy.
"""
import numpy as np

from .core import _model
from .regions import resolve_model

_DB = ("nisar_HV", "nisar_HH", "s1_VH", "s1_VV")

_INPUTS = {
    "nisar_HV": dict(unit="dB", sensor="NISAR L-діапазон", required=True,
                     source="NISAR_L2_GCOV_PROVISIONAL_V1, набір frequencyA/HVHV (лінійна потужність), висхідний прохід (поле 7 назви гранули = 'A')",
                     window="2026-07-01 .. 2026-08-31, береться гранула, найближча до 2026-07-17",
                     processing="вікно 3x3 пікселя рідної сітки GCOV; середнє в ЛІНІЙНИХ одиницях (нулі й NaN ігноруються), потім 10*log10 у dB; "
                                "піксель відкидаємо, якщо HV < -25 dB (край знімка або немає даних)"),
    "nisar_HH": dict(unit="dB", sensor="NISAR L-діапазон", required=True,
                     source="NISAR_L2_GCOV_PROVISIONAL_V1, набір frequencyA/HHHH (лінійна потужність), висхідний прохід",
                     window="та сама гранула, що й для HV",
                     processing="так само, як HV; піксель відкидаємо, якщо HH <= -25 dB"),
    "s1_VH": dict(unit="dB", sensor="Sentinel-1 C-діапазон", required=True,
                  source="COPERNICUS/S1_GRD (GEE; значення вже в dB; БЕЗ рельєфної корекції), режим IW, висхідний прохід, є канал VH",
                  window="2026-07-10 .. 2026-07-25",
                  processing="медіана за сценами в dB для кожного пікселя, потім середнє в квадраті 30 м (focalMean 30 м, square); вибірка в точці/на сітці 30 м"),
    "s1_VV": dict(unit="dB", sensor="Sentinel-1 C-діапазон", required=True,
                  source="COPERNICUS/S1_GRD, ті самі сцени, що й для VH", window="2026-07-10 .. 2026-07-25",
                  processing="так само, як VH"),
    "NDVI": dict(unit="0..1 (без масштабу)", sensor="Sentinel-2 оптика", required=True,
                 source="COPERNICUS/S2_SR_HARMONIZED (приземне відбиття)", window="2026-07-01 .. 2026-08-15",
                 processing="сцени з CLOUDY_PIXEL_PERCENTAGE < 20, медіана за сценами, NDVI = (B8 - B4) / (B8 + B4). Покрокової маски хмар немає: "
                            "рівень сцени. Модель навчена на NDVI >= 0.2 (нижче піксель невалідний)"),
}

_DERIVED = {"nisar_HVmHH": "nisar_HV - nisar_HH (dB)", "s1_VHmVV": "s1_VH - s1_VV (dB)"}
_NOT_NEEDED = ["висота над морем, схил, експозиція, кут візування S1 (s1_angle)", "тип ґрунту, клімат, покрив землі (WorldCover/MODIS), treecover2000",
               "dNBR (сила пожежі з Landsat), відстань до краю пожежі", "будь-які інші колонки (зайві аргументи в predict_arrays ігноруються)"]

_FORECAST_INPUTS = {
    "fire_year": "рік пожежі (ціле); користувач або дата згарища з MODIS MCD64A1/MTBS",
    "now_year": "рік знімків (за замовчуванням 2026)",
    "ref_height_m": ("висота лісу до пожежі: медіана GEDI L2A rh98 у кільці 1.5-6 км навколо полігона (буфер 6 км мінус буфер 1.5 км) по НЕЗГОРІЛОМУ лісу: "
                     "quality_flag = 1, degrade_flag = 0, sensitivity >= 0.95, місяці 6-9, 2019-04..2023-03; без пожеж з 2001 (MODIS MCD64A1), "
                     "без втрат крон (Hansen lossyear = 0), WorldCover = 10 (дерева); rh98 <= 35 (Канада) або 45; мінімум 100 пострілів"),
    "burned": "булева маска згарища тієї ж форми, що й растри (полігон користувача, растеризований на сітку)",
    "severity": "лише для Середземномор'я (Scenario): частка території пожежі, де Hansen (lossyear + 2000) лежить у [fire_year, fire_year + 1], 0..1",
}

_LABELS = ("Лише для навчання, на вході НЕ потрібні. Мітка = GEDI L2A rh98 (quality_flag = 1, degrade_flag = 0, sensitivity >= 0.95, місяці 6-9, "
           "2019-04..2023-03) у точках всередині згарища; прибрано: втрати крон Hansen не в рік пожежі +-1, повторні пожежі (MODIS), WorldCover 40/50/70/80/90/95, "
           "схили >= 10 градусів (Туреччина 15), rh98 > 45. Класи: до 5 м, 5-10 м, понад 10 м. Модель: логістична регресія (StandardScaler, class_weight = balanced).")


def feature_spec(region=None):
    """Повний опис входу. region: назва регіону або країни (тоді додаються діапазони валідності саме цієї моделі), None = усі готові моделі."""
    models = {}
    for r in ([resolve_model(region)] if region else ["continental", "mediterranean", "savanna"]):
        m = _model(r)
        models[r] = dict(features_order=m["features"], valid_ranges=m["ranges"], trained_on=m["trained_on"])
    return dict(
        inputs={k: dict(v) for k, v in _INPUTS.items()}, derived_inside_library=dict(_DERIVED), not_needed=list(_NOT_NEEDED),
        models=models, forecast_inputs=dict(_FORECAST_INPUTS), labels_training_only=_LABELS,
        season=("Усі навчальні композити літні (червень-вересень, з листям). Для інших місяців (сніг, без листя) модель не перевірена: це попередження варто показувати."),
        known_limits=["S1_GRD не має рельєфної корекції: на схилах понад ~10 градусів якість падає (Туреччина).",
                      "NDVI без покрокової маски хмар: у хмарних сценах значення занижені.",
                      "Усі п'ять входів обов'язкові: NaN у будь-якому = піксель невалідний (stage = -1). Варіантів без NISAR у бібліотеці ще немає.",
                      "Савана (Замбія, Танзанія): знімки липня-серпня це СУХИЙ сезон, а висота в мітках переважно понад 10 м: заголовне число p_forest_gt5 відрізняє ліс від відкритої савани, а не стадії відновлення. Вік пожежі там нічого не значить."])


def input_report(nisar_HV, nisar_HH, s1_VH, s1_VV, NDVI, region="continental", **_ignored):
    """Перевірка входу перед predict_arrays: форми, частка NaN, частка в допустимих діапазонах регіону, підозрілі одиниці.

    Повертає dict: ok (True, якщо проблем не знайдено), valid_share (частка пікселів, які пройдуть усі діапазони), per_input (статистика) і issues
    (список текстів українською: наприклад, "nisar_HV схоже на лінійну потужність, переведіть у dB: 10*log10(x)")."""
    name = resolve_model(region)
    ranges = _model(name)["ranges"]
    arrs = dict(nisar_HV=nisar_HV, nisar_HH=nisar_HH, s1_VH=s1_VH, s1_VV=s1_VV, NDVI=NDVI)
    a = {k: np.asarray(v, dtype="float64") for k, v in arrs.items()}
    issues, per = [], {}
    shapes = {k: v.shape for k, v in a.items()}
    mismatch = len({s for s in shapes.values() if s != ()}) > 1
    if mismatch:
        issues.append(f"Різні форми входів: {shapes}. Усі масиви мають бути однакової форми (або скаляр).")
    ok_all = None
    for k, v in a.items():
        fin = np.isfinite(v)
        lo, hi = ranges[k]
        inside = fin & (v >= lo) & (v <= hi)
        med = float(np.nanmedian(v)) if fin.any() else float("nan")
        per[k] = dict(n=int(v.size), nan_share=float(1 - fin.mean()) if v.size else 1.0, in_range_share=float(inside.mean()) if v.size else 0.0,
                      min=float(np.nanmin(v)) if fin.any() else float("nan"), median=med, max=float(np.nanmax(v)) if fin.any() else float("nan"))
        if not mismatch:
            ok_all = inside if ok_all is None else (ok_all & np.broadcast_to(inside, np.broadcast(ok_all, inside).shape))
        if per[k]["nan_share"] > 0.5:
            issues.append(f"{k}: понад половина значень NaN ({per[k]['nan_share']:.0%}): перевірте покриття знімками й маску.")
        if k in _DB and fin.any():
            hi99 = float(np.nanpercentile(v, 99))   # 99-й процентиль, а не максимум: один викид не має давати хибну тривогу
            if hi99 > 15 or (np.nanmedian(v) > 0 and hi99 < 3):
                issues.append(f"{k} схоже на лінійну потужність (медіана {med:.3g}), а потрібні dB: 10*log10(x). Усереднюйте в лінійних одиницях ДО переведення в dB.")
            elif per[k]["in_range_share"] < 0.8:
                issues.append(f"{k}: лише {per[k]['in_range_share']:.0%} значень у допустимому діапазоні {lo}..{hi} dB: перевірте одиниці й калібрування.")
        if k == "NDVI" and fin.any():
            if np.nanpercentile(v, 99) > 1.5:
                issues.append(f"NDVI виходить за 1 (макс. {per[k]['max']:.3g}): схоже на масштаб 0..10000, поділіть на 10000.")
            elif per[k]["in_range_share"] < 0.5:
                issues.append(f"NDVI: лише {per[k]['in_range_share']:.0%} значень >= 0.2 (модель навчена на NDVI >= 0.2): забагато води, голих ділянок чи хмар.")
    vs = float(np.mean(ok_all)) if ok_all is not None and ok_all.size else 0.0
    if vs < 0.5 and not mismatch:
        issues.append(f"Лише {vs:.0%} пікселів пройдуть усі діапазони моделі регіону {name!r}.")
    return dict(ok=not issues, valid_share=vs, per_input=per, issues=issues, region=name)
