"""forestrecovery - headless бібліотека: відновлення лісу після пожежі (стадія зараз, ріст у часі, 3D-сцена).

Приклад (таблиця, один рядок = один піксель):
    from forestrecovery import predict_table
    out = predict_table(df)          # df: nisar_HV, nisar_HH, s1_VH, s1_VV, NDVI (dB; NDVI 0..1)
    out[["stage_name", "p_forest_gt5"]]

Приклад (растри numpy будь-якої форми):
    from forestrecovery import predict_arrays
    r = predict_arrays(nisar_HV=hv, nisar_HH=hh, s1_VH=vh, s1_VV=vv, NDVI=ndvi)
    r["stage"], r["p_forest_gt5"]    # 2D масиви тієї ж форми, -1 / NaN там, де вхід невалідний

Приклад (ріст лісу в часі, те саме, що в 3D-демо):
    from forestrecovery import Growth
    sim = Growth().simulate(r, fire_year=1995, ref_height_m=9.7, burned=burn)     # r - вихід predict_arrays
    sim.recovery_at(2050), sim.height_at(2050), sim.stats_at(2050), sim.year_reached(0.8)
    Growth().years_to(0.8)            # ~41 рік після пожежі

Приклад (регіони: continental, mediterranean, savanna, monsoon; кожен має власну модель на своїх трьох країнах):
    from forestrecovery import predict_arrays, region_for, footprint_geojson
    region_for(31.43, 36.95)                                  # -> регіон, країна, надійність, пояснення (або out_of_domain)
    r = predict_arrays(..., region="auto", lon=31.43, lat=36.95)    # сама обирає модель; поза слідом перевірки віддає помилку
    footprint_geojson()                                        # де ми дивились: комірки сліду для шару на карті

Приклад (реальні дані вже всередині бібліотеки, нічого качати не треба):
    from forestrecovery import load_demo_fire, demo_globe
    f = load_demo_fire("quebec_1995_1218")       # растри NISAR + Sentinel + GEDI, піксель 90 м
    pred, sim = f.predict(), f.simulate()
    demo_globe("growth.html")                    # 3D-глобус з усіма 4 пожежами за один виклик

Приклад (готовий 3D-глобус з повзунком часу, один HTML-файл):
    from forestrecovery import FireScene, export_globe
    export_globe([FireScene.from_simulation(sim, id="f1", name="Квебек", lon=-76.3, lat=48.9, rgb=rgb)], "growth.html")
"""
from .core import (OUT_COLUMNS, STAGE_NAMES, make_dummy, model_info,  # noqa: F401
                   predict_arrays, predict_table, to_db)
from .growth import (Growth, GrowthSimulation, expected_height, growth_info,  # noqa: F401
                     stage_from_height)
from .scenario import Scenario, severity_from_loss  # noqa: F401
from .features import feature_spec, input_report  # noqa: F401
from .territory import (MIN_INSIDE, REGION_COLORS, assess_territory, coverage,  # noqa: F401
                        forecast_kind, growth_zone_geojson, scenario_zone_geojson, territory_geojson)
from .growth2 import forecast_recovery, growth_covariates_info  # noqa: F401
from .outlook import outlook  # noqa: F401
from .regions import (OutOfDomainError, accuracy, footprint_geojson, list_regions, region_for,  # noqa: F401
                      resolve_model, route)
from .scene import (FireScene, export_globe, globe_html, load_demo_rasters,  # noqa: F401
                    locate, scene_data)

from .bundle import catalog, confidence_zones, export_all, fire_bundle, write_fire_bundle  # noqa: F401
from .data import (DemoFire, data_info, demo_globe, demo_scenes, fire_boundaries,  # noqa: F401
                   list_demo_fires, list_fires, load_demo_fire, load_points)

__version__ = "0.14.0"
