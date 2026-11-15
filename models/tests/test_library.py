"""Запуск: PYTHONPATH=. .venv/bin/python tests/test_library.py"""
import warnings

import numpy as np

warnings.filterwarnings("ignore")
from forestrecovery import make_dummy, model_info, predict_arrays, predict_table, to_db
import sys
sys.path.insert(0, "scripts")
import pandas as pd
from build_regions import REGIONS, load_country
from model1 import FEATURE_SETS, FINAL_SET, make_model

# модель за замовчуванням = continental: навчена на всіх доступних країнах цього регіону
df = pd.concat([d for k in REGIONS["continental"]["countries"] if (d := load_country(k)) is not None and len(d) > 50], ignore_index=True)

# 1. Збіг із sklearn (та сама модель, навчена на тих самих даних)
cols = FEATURE_SETS[FINAL_SET]
sk = make_model("logreg").fit(df[cols], df.y)
P_sk = sk.predict_proba(df[cols])
out = predict_table(df)
P_lib = out[["p_0_5", "p_5_10", "p_gt10"]].to_numpy()
assert out.valid.all(), "навчальні дані мають бути валідними"
assert np.abs(P_sk - P_lib).max() < 1e-6, np.abs(P_sk - P_lib).max()   # float32 у виході
assert (out.stage.to_numpy() == sk.predict(df[cols])).all()
assert np.allclose(out.p_forest_gt5, out.p_5_10 + out.p_gt10, atol=1e-6)
print("1 OK  збіг із sklearn, макс. різниця:", float(np.abs(P_sk - P_lib).max()))

# 2. Невалідний вхід: NaN, поза діапазоном, NDVI < 0.2
t = make_dummy(5)
t.loc[0, "nisar_HV"] = np.nan
t.loc[1, "nisar_HV"] = 5.0         # фізично неможливо для лісу
t.loc[2, "NDVI"] = 0.1             # не ліс
r = predict_table(t)
assert list(r.valid) == [False, False, False, True, True], list(r.valid)
assert (r.stage[:3] == -1).all() and r.p_forest_gt5[:3].isna().all() and (r.stage_name[:3] == "").all()
print("2 OK  невалідні рядки маскуються")

# 3. 2D-растр: форма зберігається
H, W = 40, 60
d = make_dummy(H * W)
res = predict_arrays(**{c: d[c].to_numpy().reshape(H, W) for c in
                        ("nisar_HV", "nisar_HH", "s1_VH", "s1_VV", "NDVI")})
assert res["stage"].shape == (H, W) and res["p_forest_gt5"].shape == (H, W)
assert res["stage"].dtype == np.int8 and res["p_forest_gt5"].dtype == np.float32
print("3 OK  растр", res["stage"].shape, "частка валідних:", round(float(res["valid"].mean()), 2))

# 4. Відсутня колонка - зрозуміла помилка
try:
    predict_table(make_dummy(3).drop(columns=["s1_VV"]))
    raise SystemExit("мало бути виключення")
except ValueError as e:
    print("4 OK ", e)

# 5. Зайві аргументи/колонки ігноруються, пусті входи не падають
predict_arrays(nisar_HV=[], nisar_HH=[], s1_VH=[], s1_VV=[], NDVI=[], elev=[])
predict_table(df.assign(extra=1))
assert abs(float(to_db(0.1)) + 10) < 1e-9 and np.isnan(to_db(0.0))
print("5 OK  зайві колонки, порожні входи, to_db")
print("\nМодель:", model_info()["version"], "| навчена на:", model_info()["trained_on"])
