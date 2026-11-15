"""Реальні дані, вшиті в бібліотеку (папка data/): можна працювати одразу, нічого не качаючи.

  37 демо-пожеж з растрами (20 Канада; 13 Греція, Іспанія, Туреччина, Україна; 4 савана: Замбія, Танзанія; радар NISAR + Sentinel-1, NDVI, колір, маска згарища, GEDI) - list_demo_fires(), load_demo_fire()
  55 пожеж вибірки (регіон, рік, площа, центр)                                           - list_fires(), fire_boundaries()
  1203 точки з сигналами і висотою GEDI                                                   - load_points()

Приклад:
    from forestrecovery import load_demo_fire, demo_globe
    f = load_demo_fire("quebec_1995_1218")
    pred = f.predict()                       # стадія зараз
    sim = f.simulate()                       # ріст у часі
    sim.recovery_at(2050)
    demo_globe("growth.html")                # готовий 3D-глобус з усіма демо-пожежами

Растри мають піксель 90 м (усереднення 3x3 з 30 м). Повна роздільність (30 м) лишається у ваших GeoTIFF.
"""
import json
from pathlib import Path

import numpy as np

from .core import predict_arrays
from .growth import Growth
from .scene import FireScene, export_globe

_DIR = Path(__file__).parent / "data"

SOURCES = {
    "radar": "NISAR L2 GCOV (provisional), NASA / ASF DAAC; Sentinel-1 GRD, ESA Copernicus",
    "optical": "Sentinel-2 SR Harmonized (NDVI, колір), ESA Copernicus",
    "height": "GEDI L2A rh98, NASA / University of Maryland",
    "fires": "NBAC (National Burned Area Composite), Natural Resources Canada",
    "note": "Растри демо-пожеж: літо 2026, піксель 90 м. Дані дозволяють показати демо; для наукових висновків беріть оригінали.",
}


def data_info():
    """Що лежить у бібліотеці і звідки воно взято."""
    return dict(sources=SOURCES, demo_fires=[d["id"] for d in _demo_meta()],
                n_fires=len(list_fires()), files=sorted(p.name for p in _DIR.iterdir()))


def _demo_meta():
    return json.loads((_DIR / "demo_fires.json").read_text())


def list_demo_fires():
    """Короткий список демо-пожеж: id, назва, рік, площа, розмір растра."""
    return [dict(id=d["id"], name=d["name"], name_en=d["name_en"], fire_year=d["fire_year"], area_ha=d["area_ha"],
                 shape=d["shape"], pixel_m=d["pixel_m"]) for d in _demo_meta()]


def list_fires():
    """Усі пожежі вибірки: список dict (fire_id, fire_year, area_ha, site, cause, admin, lon, lat)."""
    return json.loads((_DIR / "fires.json").read_text())


def fire_boundaries():
    """Контури пожеж як GeoJSON-dict (спрощені до ~300 м), властивості: fire_id, year, ha, site."""
    return json.loads((_DIR / "fires.geojson").read_text())


def load_points():
    """Точки з сигналами (nisar_HV, nisar_HH, s1_VH, s1_VV, NDVI) і висотою GEDI rh98 - pandas DataFrame.
    Колонки: fire_id, site, fireYear, gediAge, latitude, longitude, ..., rh98, ref_rh98_med. Готово для predict_table."""
    import pandas as pd

    return pd.read_csv(_DIR / "points.csv.gz")


class DemoFire:
    """Одна демо-пожежа: растри (піксель 90 м), метадані й зручні методи."""

    def __init__(self, meta, inputs, rgb, outside, burned):
        self.meta, self.inputs, self.rgb, self.outside, self.burned = meta, inputs, rgb, outside, burned
        for k in ("id", "name", "name_en", "lon", "lat", "rot_deg", "fire_year", "ref_height_m", "area_ha", "pixel_m", "gedi"):
            setattr(self, k, meta[k])
        self.static = bool(meta.get("static"))      # True: поза Канадою, прогнозу росту в часі немає (лише стан зараз)

    @property
    def shape(self):
        return self.burned.shape

    def corners_lonlat(self):
        """Чотири кути растра в lon/lat у порядку лівий верхній, правий верхній, правий нижній, лівий нижній: саме так
        приймають картинку Mapbox GL (image source) і Leaflet (ImageOverlay з чотирма кутами). Растр повернутий відносно півночі.
        Потрібен pyproj; без нього ImportError."""
        from pyproj import Transformer

        nr, nc = self.shape
        x0, y0, px = self.meta["x0"], self.meta["y0"], float(self.pixel_m)
        xs, ys = [x0, x0 + nc * px, x0 + nc * px, x0], [y0, y0, y0 - nr * px, y0 - nr * px]
        lon, lat = Transformer.from_crs(self.meta["crs"], "EPSG:4326", always_xy=True).transform(xs, ys)
        return [[round(float(a), 5), round(float(b), 5)] for a, b in zip(lon, lat)]

    def predict(self):
        """Модель 1 на растрах: стадія і ймовірності (вихід predict_arrays)."""
        return predict_arrays(**self.inputs, region="auto", lon=self.lon, lat=self.lat)

    def simulate(self, now_year=2026, pred=None, growth=None, calibrate=True, allow_unvalidated=False):
        """Ріст у часі (GrowthSimulation) для цієї пожежі. Крива росту підтверджена лише для Канади: для пожеж поза нею (static) виклик
        відмовляє (OutOfDomainError), якщо не передати allow_unvalidated=True. Тоді це лише ілюстрація, а не прогноз."""
        if self.static and not allow_unvalidated:
            from .regions import OutOfDomainError
            raise OutOfDomainError(f"{self.id}: прогноз росту в часі підтверджено лише для Канади. Стан зараз дає predict(); "
                                   "ілюстративну криву дає simulate(allow_unvalidated=True).")
        return (growth or Growth()).simulate(pred if pred is not None else self.predict(), fire_year=self.fire_year, now_year=now_year,
                                             ref_height_m=self.ref_height_m, burned=self.burned, calibrate=calibrate)

    def scene(self, now_year=2026, sim=None):
        """FireScene для 3D-глобуса (export_globe)."""
        sim = sim or self.simulate(now_year, allow_unvalidated=True)     # для static сцена бере лише стан зараз (r0)
        return FireScene.from_simulation(sim, id=self.id, name=self.name, name_en=self.name_en, lon=self.lon, lat=self.lat,
                                         rot_deg=self.rot_deg, rgb=self.rgb, ndvi=self.inputs["NDVI"], gedi=self.gedi,
                                         outside=self.outside, area_ha=self.area_ha, block=4, pixel_m=self.pixel_m,
                                         static=bool(self.meta.get("static")))


def load_demo_fire(fire_id):
    """Завантажує демо-пожежу за id (див. list_demo_fires)."""
    metas = {d["id"]: d for d in _demo_meta()}
    if fire_id not in metas:
        raise KeyError(f"Невідома пожежа {fire_id!r}. Є: {sorted(metas)}")
    meta = metas[fire_id]
    z = np.load(_DIR / f"demo_{fire_id}.npz")
    nr, nc = (int(v) for v in z["shape"])
    unpack = lambda k: np.unpackbits(z[k])[: nr * nc].reshape(nr, nc).astype(bool)
    outside, burned = unpack("outside"), unpack("burned")
    inputs = {k: z[k].astype("float32") for k in ("nisar_HV", "nisar_HH", "s1_VH", "s1_VV", "NDVI")}
    for v in inputs.values():
        v[outside] = np.nan
    rgb = np.stack([z["rgb_r"], z["rgb_g"], z["rgb_b"]], -1).astype("float32")
    return DemoFire(meta, inputs, rgb, outside, burned)


def demo_scenes(now_year=2026):
    """Усі демо-пожежі як список FireScene (модель 1; ріст за моделлю 2 лише для канадських)."""
    return [load_demo_fire(d["id"]).scene(now_year) for d in _demo_meta()]


def demo_globe(path, now_year=2026, standalone=True):
    """Один виклик: готовий 3D-глобус з усіма 4 демо-пожежами в HTML-файл."""
    return export_globe(demo_scenes(now_year), path, now_year=now_year, standalone=standalone)
