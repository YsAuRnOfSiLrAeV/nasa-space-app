"""Набір файлів на пожежу для фронту: каталог, результат моделей 1 і 2, клітинки, контур.

    from forestrecovery import catalog, fire_bundle, write_fire_bundle
    catalog()                                   # усі пожежі, які можна порахувати (id, рік, площа, регіон, що для них є)
    b = fire_bundle("quebec_1995_1218")         # {'manifest', 'result', 'cells', 'polygon'}
    b["result"]["model2"]["year_80pct"]         # рік, коли відновиться 80% висоти сусіднього лісу
    write_fire_bundle("quebec_1995_1218", "out/")   # out/fire_<id>/summer_2026/: manifest, result, cells, cells.geojson, gedi.geojson, polygon.geojson, rgb.png, timeline
    export_all("out/")                              # усі пожежі + out/index.json + confidence_zones.geojson (для пайплайна); те саме: python -m forestrecovery export out/

Формат кожного файлу з прикладами для Mapbox / Leaflet / pandas: BUNDLE_FORMAT.md (лежить у пакеті: forestrecovery/BUNDLE_FORMAT.md).

Скільки є для кожної пожежі:
  has_grid=True   повні растри: карта моделі 1 по клітинках 360 м (cells), стан по всій площі
  has_grid=False  лише точки GEDI: оцінка моделі 1 у точках, без карти по площі
  forecast        'growth' (модель 2: прогноз у роках, лише Канада) | 'state_only' (поза Канадою: лише стан зараз) | 'none'

Модель 1 дає оцінку для ранжування, а не калібровану ймовірність. Модель 2 підтверджена лише для Канади.
"""
import json
import struct
import warnings
import zlib
from pathlib import Path

import numpy as np

from .core import predict_table
from .data import _DIR, _demo_meta, fire_boundaries, list_fires, load_demo_fire, load_points
from .growth2 import forecast_recovery
from .regions import OutOfDomainError, region_for

BLOCK = 4                    # піксель 90 м * 4 = клітинка 360 м
RELIABILITY = {
    "model1": ("ranking score, not a calibrated probability; a summary over the whole fire is more reliable than a single cell. "
               "Pixels whose signals fall outside the model's training range (bare or very dark ground) are excluded; excluded_share says how much, "
               "and the numbers are slightly optimistic by about that share"),
    "model2": ("growth curve validated for Canada, fire age 8-36 years; the 80% interval covered 82% of fires (nominal 80%). "
               "On 9 fires outside the training regions it overestimated recovery by ~12 points on average"),
}


def _covs():
    p = _DIR / "fire_covariates.json"
    return json.loads(p.read_text()) if p.exists() else {}


def _cell_xy(meta, rr, cc):
    """Центри клітинок 360 м у метрах проєкції растра (верхній лівий кут x0, y0; піксель pixel_m; рядки йдуть на південь)."""
    px = float(meta["pixel_m"])
    return meta["x0"] + (np.asarray(cc) * BLOCK + BLOCK / 2) * px, meta["y0"] - (np.asarray(rr) * BLOCK + BLOCK / 2) * px


def _to_lonlat(crs, x, y):
    try:
        from pyproj import Transformer
    except ImportError:
        return None, None
    return Transformer.from_crs(crs, "EPSG:4326", always_xy=True).transform(x, y)


def _utm(lon, lat):
    zone = int((lon + 180) // 6) + 1
    return (32600 if lat >= 0 else 32700) + zone


def catalog():
    """Усі пожежі, які можна порахувати: список dict (id, year, area_ha, region, lon, lat, has_grid, has_points, forecast)."""
    demo = {d["id"]: d for d in _demo_meta()}
    covs, pts_ids = _covs(), set(load_points().fire_id.unique())
    out, seen = [], set()
    for f in list_fires():
        seen.add(f["fire_id"])
        out.append(dict(id=f["fire_id"], year=int(f["fire_year"]), area_ha=float(f["area_ha"]), region=f["site"], lon=f["lon"], lat=f["lat"]))
    for i, d in demo.items():
        if i not in seen:
            out.append(dict(id=i, year=int(d["fire_year"]), area_ha=float(d["area_ha"]), region=i.split("_")[0], lon=d["lon"], lat=d["lat"]))
    for o in out:
        d = demo.get(o["id"])
        o["has_grid"] = d is not None
        o["has_points"] = o["id"] in pts_ids
        o["forecast"] = ("state_only" if d and d.get("static") else "growth" if o["id"] in covs else "none")
    return sorted(out, key=lambda o: (o["region"], o["year"], o["id"]))


def _polygon(fire_id):
    feats = list(fire_boundaries()["features"])
    extra = _DIR / "fires_extra.geojson"            # контури додаткових демо-пожеж (серединні, Європа)
    if extra.exists():
        feats += json.loads(extra.read_text())["features"]
    for f in feats:
        if f["properties"]["fire_id"] == fire_id:
            return dict(type="Feature", properties=f["properties"], geometry=f["geometry"])
    return None


def _model1(entry):
    """(summary, cells). Із растрів, якщо вони є; інакше з точок GEDI."""
    if entry["has_grid"]:
        f = load_demo_fire(entry["id"])
        p = np.where(f.outside, np.nan, f.predict()["p_forest_gt5"])
        nr, nc = p.shape
        R, C = nr // BLOCK, nc // BLOCK
        blk = p[:R * BLOCK, :C * BLOCK].reshape(R, BLOCK, C, BLOCK).transpose(0, 2, 1, 3).reshape(R, C, BLOCK * BLOCK)
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", RuntimeWarning)       # порожні клітинки поза пожежею дають NaN
            cells = np.nanmean(blk, axis=2)
        cells[np.isfinite(blk).mean(axis=2) < .5] = np.nan
        rr, cc = np.nonzero(np.isfinite(cells))
        v = cells[rr, cc]
        x, y = _cell_xy(f.meta, rr, cc)
        lon, lat = _to_lonlat(f.meta["crs"], x, y)
        out = []
        for k, (r, c, pv) in enumerate(zip(rr, cc, v)):
            d = dict(row=int(r), col=int(c), x=round(float(x[k]), 1), y=round(float(y[k]), 1))
            if lon is not None:
                d.update(lon=round(float(lon[k]), 5), lat=round(float(lat[k]), 5))
            out.append(d | dict(p_forest_gt5=round(float(pv), 3)))
        burned = f.burned & ~f.outside
        used = int((burned & np.isfinite(p)).sum())          # у розрахунок іде піксель, де всі 5 сигналів скінченні й у межах навчання моделі
        s = dict(unit="cell", cell_m=BLOCK * int(f.pixel_m), n=int(len(v)), mean=round(float(v.mean()), 3), share_gt_0_5=round(float((v > .5).mean()), 3),
                 grid_shape=[int(R), int(C)], burned_pixels=int(burned.sum()), used_pixels=used,
                 excluded_share=round(float(1 - used / burned.sum()), 3) if burned.sum() else None)
        gx = np.array([f.meta["x0"] + g[1] * f.pixel_m for g in f.gedi], dtype=float)        # g = (рядок, стовпець, висота) у пікселях растра
        gy = np.array([f.meta["y0"] - g[0] * f.pixel_m for g in f.gedi], dtype=float)
        glon, glat = _to_lonlat(f.meta["crs"], gx, gy) if len(gx) else (None, None)
        gedi = [dict(x=round(float(gx[k]), 1), y=round(float(gy[k]), 1), rh98_m=float(g[2]),
                     **({} if glon is None else dict(lon=round(float(glon[k]), 5), lat=round(float(glat[k]), 5)))) for k, g in enumerate(f.gedi)]
        return s, dict(cell_m=BLOCK * int(f.pixel_m), shape=[int(R), int(C)], crs_source=str(f.meta["crs"]), rot_deg=f.rot_deg,
                       note="x, y: cell centre in metres of crs_source; lon, lat: WGS84 (present when pyproj is installed). row, col index the source raster grid. gedi: measured canopy heights (rh98, m).",
                       cells=out, gedi=gedi)
    pts = load_points()
    sub = pts[pts.fire_id == entry["id"]]
    if sub.empty:
        return None, None
    r = predict_table(sub, region="auto")
    v = r.p_forest_gt5[r.valid].to_numpy()
    s = dict(unit="point", n=int(len(v)), mean=round(float(v.mean()), 3), share_gt_0_5=round(float((v > .5).mean()), 3),
             excluded_share=round(float(1 - len(v) / len(sub)), 3),
             gedi_pct_of_reference=round(float(100 * sub.rh98.mean() / sub.ref_rh98_med.median())))
    return s, None


def _model2(entry, now_year):
    if entry["forecast"] == "state_only":
        return dict(forecast="none", reason="outside Canada: the growth curve is validated for Canada only; the state now is given by model 1")
    cov = _covs().get(entry["id"])
    if cov is None:
        return dict(forecast="none", reason="no fire covariates for this fire")
    try:
        f = forecast_recovery(entry["year"], cov, horizon=40, now_year=now_year, lon=entry["lon"], lat=entry["lat"])
    except OutOfDomainError as e:
        return dict(forecast="none", reason=f"outside the validated zone: {e}")
    i = f["years"].index(now_year) if now_year in f["years"] else None
    return dict(forecast="growth", valid_region="canada", now_recovery=f["now_recovery"], interval_80=None if i is None else [f["low"][i], min(f["high"][i], 1.3)],
                year_80pct=f["year_80pct"], years_to_80pct=f["years_to_80pct"], warnings=f["warnings"],
                series=dict(years=f["years"], recovery=f["recovery"], low=f["low"], high=f["high"]))


def _round_coords(c, nd=3):
    return [_round_coords(x, nd) for x in c] if isinstance(c, list) and c and isinstance(c[0], list) else [round(float(x), nd) for x in c]


def confidence_zones():
    """Зони впевненості одним GeoJSON (FeatureCollection) для шару на карті. Кожна ділянка має `layer`:
      model1_region     де працює модель 1 (стан зараз). `tier` 1 / `status` verified: ми там перевіряли; tier 2 / extrapolated: той самий тип лісу,
                        напряму не перевірено. `region`, `reliability` (good|moderate|low: найгірша країна регіону), `color`, `opacity`, `name_uk`, `name_en`
      model2_growth     де крива росту (прогноз у роках) підтверджена: лише Канада, вік пожежі 8-36 років
      model2_scenario   де працює сценарій «від сили пожежі» (лише Україна, перевірений рівень)
    Поза цими ділянками ми не стверджуємо нічого (`out_of_domain`). Координати округлені до 0.001 градуса (~100 м)."""
    from .territory import growth_zone_geojson, scenario_zone_geojson, territory_geojson
    feats = []
    for f in territory_geojson()["features"]:
        pr = f["properties"]
        tier = pr.get("tier", 1)
        feats.append(dict(type="Feature", geometry=dict(type=f["geometry"]["type"], coordinates=_round_coords(f["geometry"]["coordinates"])),
                          properties=dict(layer="model1_region", region=pr["region"], tier=tier, status="verified" if tier == 1 else "extrapolated",
                                          reliability=pr.get("rel"), color=pr.get("color"), opacity=pr.get("opacity"), name_uk=pr.get("name"), name_en=pr.get("name_en"))))
    for fc, layer, uk, en in ((growth_zone_geojson(), "model2_growth", "Прогноз росту підтверджено (Канада)", "Growth forecast validated (Canada)"),
                              (scenario_zone_geojson(), "model2_scenario", "Сценарій сили пожежі (Україна)", "Fire-severity scenario (Ukraine)")):
        for f in fc["features"]:
            feats.append(dict(type="Feature", geometry=dict(type=f["geometry"]["type"], coordinates=_round_coords(f["geometry"]["coordinates"])),
                              properties=dict(layer=layer, status="verified", name_uk=uk, name_en=en)))
    from . import __version__
    return dict(type="FeatureCollection", library_version=__version__, features=feats)


def _png(rgba):
    """PNG (RGBA, 8 біт) без зовнішніх бібліотек."""
    h, w, _ = rgba.shape
    raw = b"".join(b"\x00" + rgba[i].tobytes() for i in range(h))

    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw, 6)) + chunk(b"IEND", b""))


def _block_mean(a):
    """Середнє по блоках BLOCK x BLOCK (NaN ігноруються): масив (R, C)."""
    nr, nc = a.shape
    R, C = nr // BLOCK, nc // BLOCK
    blk = a[:R * BLOCK, :C * BLOCK].reshape(R, BLOCK, C, BLOCK).transpose(0, 2, 1, 3).reshape(R, C, BLOCK * BLOCK)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)
        return np.nanmean(blk, axis=2)


def _r(v, nd):
    return None if not np.isfinite(v) else round(float(v), nd)


def _grid_extras(entry, cells, now_year, growth):
    """Те, що тримається на растрах: стан по клітинках (recovery, height_m, ndvi у самих клітинках), картинка rgb.png,
    географічні файли для карти і (для пожеж із прогнозом) відновлення по клітинках за роками."""
    f = load_demo_fire(entry["id"])
    sim = f.simulate(now_year, allow_unvalidated=True)               # для static береться лише стан зараз
    rr = np.array([c["row"] for c in cells["cells"]], dtype=int)
    cc = np.array([c["col"] for c in cells["cells"]], dtype=int)
    inside = ~f.outside

    def per_cell(arr):
        return _block_mean(np.where(inside, arr, np.nan))[rr, cc]
    rec = per_cell(sim.recovery_at(now_year))
    ndvi = per_cell(f.inputs["NDVI"])
    ref = float(sim.ref_height_m)
    for k, c in enumerate(cells["cells"]):
        c["recovery"], c["height_m"], c["ndvi"] = _r(rec[k], 3), _r(rec[k] * ref, 1), _r(ndvi[k], 3)
    cells["fields"] = dict(
        p_forest_gt5="model 1 score 0..1 (ranking, not a calibrated probability)",
        recovery="state in the summer of now_year: share of the neighbouring-forest height regained (0..1, can slightly exceed 1)",
        height_m="recovery * reference_height_m: modelled canopy height, not measured",
        ndvi="Sentinel-2 NDVI, mean over the cell")
    cells["reference_height_m"] = round(ref, 2)
    cells["reference_source"] = ("gedi_neighbour_forest_median" if f.ref_height_m else "scene_p75_unburned_forest (no GEDI reference for this fire: not a validated reference)")
    gj = None
    if cells["cells"][0].get("lon") is not None:
        from pyproj import Transformer
        half = BLOCK * float(f.pixel_m) / 2
        xs = np.array([c["x"] for c in cells["cells"]]); ys = np.array([c["y"] for c in cells["cells"]])
        tr = Transformer.from_crs(f.meta["crs"], "EPSG:4326", always_xy=True)
        cx = np.stack([xs - half, xs + half, xs + half, xs - half, xs - half], 1)
        cy = np.stack([ys + half, ys + half, ys - half, ys - half, ys + half], 1)
        lo, la = tr.transform(cx, cy)
        feats = [dict(type="Feature", properties=dict(i=k, row=c["row"], col=c["col"], p_forest_gt5=c["p_forest_gt5"], recovery=c["recovery"],
                                                       height_m=c["height_m"], ndvi=c["ndvi"]),
                      geometry=dict(type="Polygon", coordinates=[[[round(float(a), 5), round(float(b), 5)] for a, b in zip(lo[k], la[k])]]))
                 for k, c in enumerate(cells["cells"])]
        gj = dict(type="FeatureCollection", features=feats)
    gedi = None
    if cells["gedi"] and cells["gedi"][0].get("lon") is not None:
        gedi = dict(type="FeatureCollection", features=[dict(type="Feature", properties=dict(rh98_m=g["rh98_m"]), geometry=dict(type="Point", coordinates=[g["lon"], g["lat"]]))
                                                         for g in cells["gedi"]])
    rgb = np.asarray(f.rgb, dtype="float64")
    fin = np.isfinite(rgb).all(axis=-1)
    img = np.zeros(rgb.shape[:2] + (4,), dtype="uint8")
    if fin.any():
        lo98 = np.nanpercentile(rgb[fin], 98)
        v = np.clip(np.where(np.isfinite(rgb), rgb, 0) / (lo98 if lo98 > 0 else 1), 0, 1) ** 0.8
        img[..., :3] = (v * 255).round().astype("uint8")
        img[..., 3] = np.where(fin, 255, 0)
    try:
        corners = f.corners_lonlat()
    except ImportError:
        corners = None
    image = dict(file="rgb.png", width=int(img.shape[1]), height=int(img.shape[0]), pixel_m=int(f.pixel_m), corners_lonlat=corners,
                 corners_order="top-left, top-right, bottom-right, bottom-left (Mapbox image source / Leaflet corners)",
                 note="Sentinel-2 true colour, July-August 2026, brightness stretched (98th percentile, gamma 0.8). The raster is rotated relative to north; place it by corners_lonlat.")
    timeline = None
    if growth:
        years = list(range(int(entry["year"]), now_year + 41))
        timeline = dict(years=years, cells="same order as cells.json", ref_height_m=round(ref, 2),
                        note="recovery_pct[y][k] = recovery of cell k in years[y], whole percent (0..130), null = no data. Pixel-level extrapolation anchored to the state now; "
                             "the same animation as in the globe. The fire-level forecast with an 80% interval is in result.json -> model2.",
                        recovery_pct=[[None if not np.isfinite(v) else int(round(100 * float(v))) for v in per_cell(sim.recovery_at(y))] for y in years])
    return dict(cells_geojson=gj, gedi_geojson=gedi, rgb_png=_png(img), image=image, timeline=timeline, ref=(cells["reference_height_m"], cells["reference_source"]))


_ROLES = {"manifest.json": "this list", "result.json": "numbers for the panel: model 1 summary, model 2 forecast with interval, reliability notes",
          "cells.json": "cells with model 1 score, recovery now, height, ndvi; GEDI posts (compact, for code)",
          "cells.geojson": "the same cells as square polygons in lon/lat: add as a fill layer on a map",
          "gedi.geojson": "measured GEDI canopy heights (rh98, m) as points", "polygon.geojson": "fire contour",
          "rgb.png": "Sentinel-2 true-colour picture; place by result.image.corners_lonlat",
          "timeline.json": "recovery of every cell by year (growth fires only)"}


def _bundle_for(entry, now_year):
    s1, cells = _model1(entry)
    rg = region_for(entry["lon"], entry["lat"])
    model2 = _model2(entry, now_year)
    ex = _grid_extras(entry, cells, now_year, model2.get("forecast") == "growth") if cells else {}
    result = dict(
        fire=dict(id=entry["id"], year=entry["year"], area_ha=entry["area_ha"], region=entry["region"], centroid=[entry["lon"], entry["lat"]],
                  model_region=rg.get("region"), reliability_of_region=rg.get("reliability")),
        period=dict(summer=now_year, months=[6, 7, 8]),
        grid=dict(cell_m=BLOCK * 90, crs_pipeline=f"EPSG:{_utm(entry['lon'], entry['lat'])}", built=bool(cells)),
        model1=None if s1 is None else dict(headline="p_forest_gt5", meaning="ranking_score_not_calibrated_probability", **s1),
        model2=model2,
        reference=None if not ex else dict(height_m=ex["ref"][0], source=ex["ref"][1]),
        image=ex.get("image"),
        reliability=RELIABILITY)
    poly = _polygon(entry["id"])
    from . import __version__
    have = {"result.json": True, "cells.json": bool(cells), "cells.geojson": bool(ex.get("cells_geojson")), "gedi.geojson": bool(ex.get("gedi_geojson")),
            "polygon.geojson": bool(poly), "rgb.png": bool(ex.get("rgb_png")), "timeline.json": bool(ex.get("timeline"))}
    files = [n for n, ok in have.items() if ok]
    manifest = dict(bundle_format=2, library_version=__version__, fire_id=entry["id"], summer=now_year, files=["manifest.json"] + files,
                    roles={n: _ROLES[n] for n in ["manifest.json"] + files})
    return dict(manifest=manifest, result=result, cells=cells, polygon=poly, cells_geojson=ex.get("cells_geojson"), gedi_geojson=ex.get("gedi_geojson"),
                rgb_png=ex.get("rgb_png"), timeline=ex.get("timeline"))


def fire_bundle(fire_id, now_year=2026):
    """Набір для однієї пожежі: dict з ключами manifest, result, cells, polygon, cells_geojson, gedi_geojson, rgb_png (bytes), timeline.
    Те, чого для пожежі немає (немає растрів, немає прогнозу), дорівнює None. KeyError, якщо пожежі немає."""
    entry = next((o for o in catalog() if o["id"] == fire_id), None)
    if entry is None:
        raise KeyError(f"Невідома пожежа {fire_id!r}. Список: catalog()")
    return _bundle_for(entry, now_year)


_FILES = (("manifest.json", "manifest"), ("result.json", "result"), ("cells.json", "cells"), ("cells.geojson", "cells_geojson"), ("gedi.geojson", "gedi_geojson"),
          ("polygon.geojson", "polygon"), ("timeline.json", "timeline"), ("rgb.png", "rgb_png"))


def _write(b, fire_id, out_dir, now_year):
    d = Path(out_dir) / f"fire_{fire_id}" / f"summer_{now_year}"
    d.mkdir(parents=True, exist_ok=True)
    paths = []
    for name, key in _FILES:
        obj = b[key]
        if obj is None:
            continue
        if isinstance(obj, bytes):
            (d / name).write_bytes(obj)
        else:
            (d / name).write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        paths.append(d / name)
    return paths


def write_fire_bundle(fire_id, out_dir, now_year=2026):
    """Записує набір у out_dir/fire_<id>/summer_<рік>/ і повертає список шляхів (див. manifest.json: які файли є для цієї пожежі)."""
    return _write(fire_bundle(fire_id, now_year), fire_id, out_dir, now_year)


def export_all(out_dir, fire_ids=None, now_year=2026, progress=None):
    """Пише набори для всіх пожеж каталогу (або для fire_ids) і out_dir/index.json: список пожеж із ключовими цифрами і шляхами до файлів.
    Зручно для пайплайна: один виклик, далі читати index.json. Поруч кладе viewer.html: карта з усіма шарами, відкривати через
    `python -m http.server` у цій папці. Повертає шлях до index.json."""
    cat = catalog()
    if fire_ids:
        unknown = sorted(set(fire_ids) - {o["id"] for o in cat})
        if unknown:
            raise KeyError(f"Невідомі пожежі {unknown}. Список: catalog()")
        cat = [o for o in cat if o["id"] in set(fire_ids)]
    index = []
    for n, entry in enumerate(cat):
        b = _bundle_for(entry, now_year)
        paths = _write(b, entry["id"], out_dir, now_year)
        r, m1, m2 = b["result"], b["result"]["model1"], b["result"]["model2"]
        index.append(dict(entry, dir=str(paths[0].parent.relative_to(out_dir)), files=[p.name for p in paths],
                          model1_mean=None if m1 is None else m1["mean"], model1_share_gt_0_5=None if m1 is None else m1["share_gt_0_5"],
                          excluded_share=None if m1 is None else m1["excluded_share"], recovery_now=m2.get("now_recovery"), year_80pct=m2.get("year_80pct")))
        if progress:
            progress(n + 1, len(cat), entry["id"])
    p = Path(out_dir) / "index.json"
    from . import __version__
    p.write_text(json.dumps(dict(bundle_format=2, library_version=__version__, summer=now_year, fires=index), ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (Path(out_dir) / "confidence_zones.geojson").write_text(json.dumps(confidence_zones(), ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    v = Path(__file__).parent / "assets" / "viewer.tpl.html"
    (Path(out_dir) / "viewer.html").write_text(v.read_text(encoding="utf-8"), encoding="utf-8")   # перегляд: python -m http.server у цій папці, далі /viewer.html
    return p
