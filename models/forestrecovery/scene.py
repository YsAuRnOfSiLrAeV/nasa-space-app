"""3D-сцена «ліс росте»: готовий інтерактивний глобус (Three.js) з пожежами та повзунком часу.

Залежності: numpy. rasterio і pyproj потрібні лише для load_demo_rasters() / locate().
Сторінка тягне Three.js із cdnjs, тож потрібен інтернет; усі дані вшиті в один HTML-файл.

Приклад:
    from forestrecovery import Growth, FireScene, export_globe
    sim = Growth().simulate(pred, fire_year=1995, ref_height_m=9.7, burned=burn)
    scene = FireScene.from_simulation(sim, id="quebec_1995", name="Квебек", name_en="Quebec",
                                      lon=-76.29, lat=48.88, rgb=rgb, ndvi=ndvi, gedi=[(row, col, rh98), ...])
    export_globe([scene, ...], "forest_growth.html")           # відкрити в браузері
Для власного фронтенду: scene_data([scene, ...]) повертає dict (JSON), з якого можна малювати що завгодно.
"""
import json
from pathlib import Path

import numpy as np

from .growth import Growth

_ASSETS = Path(__file__).parent / "assets"
_DOCTYPE = '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'


def _bmean(a, nr, nc, k):
    with np.errstate(all="ignore"):
        return np.nanmean(a[:nr * k, :nc * k].reshape(nr, k, nc, k), axis=(1, 3))


class FireScene:
    """Одна пожежа, підготовлена для сцени: клітинки (блоки block x block пікселів) зі станом, кольором і ознакою згарища."""

    def __init__(self, data):
        self.data = data

    @property
    def id(self):
        return self.data["id"]

    @classmethod
    def from_simulation(cls, sim, *, id, name, lon, lat, name_en=None, rgb=None, ndvi=None, gedi=(), outside=None,
                        rot_deg=0.0, area_ha=0, block=12, pixel_m=30.0, static=False):
        """sim      GrowthSimulation (2D, форма H x W).
        lon, lat    центр растра (WGS84). rot_deg - кут між північчю растра і справжньою північчю (locate() його рахує).
        rgb         (H, W, 3) відбиття 0..1 для режиму «як бачить оптика»; ndvi - (H, W) для висоти в цьому режимі.
        gedi        [(рядок, стовпець, висота_м), ...] у пікселях растра - вимірювання GEDI (стовпчики на сцені).
        outside     bool-маска пікселів поза растром (не малюються). Не задано = невалідні пікселі поза згарищем.
        block       скільки пікселів у стороні однієї клітинки (12 пікселів по 30 м = 360 м).
        static      True для регіонів без прогнозу росту в часі (не Канада): сцена показує лише стан зараз, повзунок часу її не рухає."""
        if sim.r0.ndim != 2:
            raise ValueError("FireScene потребує 2D-симуляції (H x W)")
        H, W = sim.shape
        nr, nc = H // block, W // block
        outside = (~sim.valid & ~sim.burned) if outside is None else np.asarray(outside, dtype=bool)
        frac = lambda m: _bmean(m.astype(float), nr, nc, block)
        draw = (frac(outside) < 0.5) & (frac(sim.valid) > 0.3)
        burn = frac(sim.burned) > 0.5
        r0 = np.nan_to_num(_bmean(sim.r0, nr, nc, block), nan=0.5)
        nd = np.full((nr, nc), 0.6) if ndvi is None else np.nan_to_num(_bmean(np.asarray(ndvi, float), nr, nc, block), nan=0.6)
        if rgb is None:
            rgbc = np.broadcast_to(np.array([0.30, 0.45, 0.28]), (nr, nc, 3))
        else:
            rgbn = np.asarray(rgb, dtype="float64").copy()
            rgbn[outside] = np.nan
            rgbc = np.stack([_bmean(rgbn[..., i], nr, nc, block) for i in range(3)], -1)
            rgbc = np.clip(rgbc / np.nanpercentile(rgbc, 98), 0, 1) ** 0.8
            rgbc = np.nan_to_num(rgbc, nan=0.3)
        ii, jj = np.nonzero(draw)
        cells = np.column_stack([ii, jj, burn[ii, jj].astype(int), np.round(r0[ii, jj] * 100), np.round(nd[ii, jj] * 100),
                                 np.round(rgbc[ii, jj] * 100)]).astype(int)
        data = dict(id=id, uk=name, en=name_en or name, lon=round(float(lon), 3), lat=round(float(lat), 3), ha=int(area_ha),
                    fireYear=int(sim.fire_year), ageNow=int(round(sim.age_now)), refH=round(sim.ref_height_m, 1),
                    rot=round(float(np.radians(rot_deg)), 4), nr=int(nr), nc=int(nc), cellKm=round(block * pixel_m / 1000.0, 3),
                    c=cells.ravel().tolist(),
                    gedi=[[round(float(c) / block, 2), round(float(r) / block, 2), round(float(h), 1)] for r, c, h in gedi])
        if static:
            data["static"] = True
        return cls(data)


def scene_data(fires, growth=None, now_year=None):
    """Словник для фронтенду: {'meta': {A, tau, t80, now}, 'fires': [...]}. Його ж вшиває export_globe."""
    g = growth or Growth()
    fires = [f.data if isinstance(f, FireScene) else f for f in fires]
    now = now_year or (fires[0]["fireYear"] + fires[0]["ageNow"] if fires else 2026)
    return dict(meta=dict(A=g.A, tau=round(g.tau, 2), t80=round(g.years_to(0.8), 1), now=int(now)), fires=fires)


def globe_html(fires, *, growth=None, now_year=None, standalone=True, territory=None, points=None, zones=None, scen=None):
    """HTML-текст глобуса. standalone=True додає doctype і meta (для окремого файлу); False - для публікації як артефакт."""
    tpl = (_ASSETS / "globe.tpl.html").read_text(encoding="utf-8")
    world = (_ASSETS / "world.json").read_text()
    html = (tpl.replace("__FIRES__", json.dumps(scene_data(fires, growth, now_year), separators=(",", ":"))).replace("__WORLD__", world)
            .replace("__TERRITORY__", json.dumps(territory, separators=(",", ":")) if territory else "null")
            .replace("__POINTS__", json.dumps(points, separators=(",", ":")) if points else "null")
            .replace("__ZONES__", json.dumps(zones, separators=(",", ":")) if zones else "null")
            .replace("__SCEN__", json.dumps(scen, separators=(",", ":")) if scen else "null"))
    return (_DOCTYPE + html) if standalone else html


def export_globe(fires, path, *, growth=None, now_year=None, standalone=True, territory=None, points=None, zones=None, scen=None):
    """Записує глобус у файл і повертає шлях. fires - список FireScene."""
    path = Path(path)
    path.write_text(globe_html(fires, growth=growth, now_year=now_year, standalone=standalone, territory=territory, points=points, zones=zones, scen=scen), encoding="utf-8")
    return path


# ---------------------------------------------------------------- допоміжне для геоданих (потрібні pyproj / rasterio)
def locate(x, y, crs="EPSG:3347"):
    """Центр растра в проєкції crs -> (lon, lat, rot_deg). rot_deg: на скільки справжня північ відхилена від «вгору» растра."""
    from pyproj import Transformer

    to = Transformer.from_crs(crs, "EPSG:4326", always_xy=True)
    lon, lat = to.transform(x, y)
    fw = Transformer.from_crs("EPSG:4326", crs, always_xy=True)
    x1, y1 = fw.transform(lon, lat)
    x2, y2 = fw.transform(lon, lat + 0.01)
    return float(lon), float(lat), float(np.degrees(np.arctan2(x2 - x1, y2 - y1)))


def load_demo_rasters(demo_tif, nisar_tif):
    """Читає пару растрів з GEE-експорту (6 каналів: s1_VV, s1_VH, NDVI, rgb_r/g/b) і Colab (nisar_HH, nisar_HV).
    Повертає dict: масиви для predict_arrays (nisar_HV, nisar_HH, s1_VH, s1_VV, NDVI), rgb, outside, transform, crs."""
    import rasterio

    with rasterio.open(demo_tif) as s:
        a, tr, crs = s.read(), s.transform, s.crs
    with rasterio.open(nisar_tif) as s:
        n = s.read()
    if n.shape[1:] != a.shape[1:]:
        raise ValueError("Сітки растрів не збігаються")
    vv, vh, ndvi = a[0].copy(), a[1].copy(), a[2].copy()
    outside = ~(np.isfinite(vv) & (vv != 0))
    out = dict(nisar_HH=n[0].copy(), nisar_HV=n[1].copy(), s1_VH=vh, s1_VV=vv, NDVI=ndvi)
    for v in out.values():
        v[outside] = np.nan
    return dict(inputs=out, rgb=np.stack([a[3], a[4], a[5]], -1), outside=outside, transform=tr, crs=crs)
