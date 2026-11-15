"""Перевірка моделі 2 на синтетичних даних зі ВІДОМОЮ відповіддю.
Запуск: PYTHONPATH=. .venv/bin/python tests/test_model2.py
"""
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")
from model2 import build_fire_table, fit, forecast, is_valid, lofo, predict_recovery, years_to

rng = np.random.default_rng(1)
N = 60
# справжній закон: tau = exp(2.7 - 0.5*decid + 0.4*dnbr_z), A = 0.95
F = pd.DataFrame(dict(
    fire_id=[f"f{i}" for i in range(N)], age=rng.uniform(8, 40, N),
    dnbr=rng.normal(0, 1, N), decid_share=rng.normal(0, 1, N), noise_feat=rng.normal(0, 1, N)))
tau = np.exp(2.7 - 0.5 * F.decid_share + 0.4 * F.dnbr)
F["recovery"] = (0.95 * (1 - np.exp(-F.age / tau)) + rng.normal(0, 0.05, N)).clip(0, 1.5)
F["n"] = rng.integers(10, 30, N)
F["site"] = "x"
feats = ["dnbr", "decid_share", "noise_feat"]

# 1. Підгонка відновлює знаки та порядок коефіцієнтів
m = fit(F, feats)
A, b0, b_dnbr, b_decid, b_noise = m["theta"]
print("1  A=%.2f b0=%.2f  dnbr=%.2f decid=%.2f noise=%.2f  (правда: 0.95, 2.7, +0.4, -0.5, 0)" % (A, b0, b_dnbr, b_decid, b_noise))
assert b_dnbr > 0.1 and b_decid < -0.1, "знаки коефіцієнтів не відновились"
assert abs(b_noise) < min(abs(b_dnbr), abs(b_decid)), "шум-ознака має мати менший коефіцієнт"

# 2. LOFO: крива з ознаками краща за константу та за криву лише за віком
metrics, _ = lofo(F, feats)
print(metrics.round(3).to_string())
assert metrics.loc["curve+feats", "rmse"] < metrics.loc["const", "rmse"]
assert metrics.loc["curve+feats", "rmse"] < metrics.loc["age_curve", "rmse"]
assert is_valid(metrics, N, float(F.age.max() - F.age.min()))
print("2  OK  LOFO: модель б'є базові, is_valid=True")

# 3. Нульовий сигнал (випадкові recovery): модель НЕ має проходити перевірку
G = F.copy()
G["recovery"] = rng.uniform(0.2, 1.0, N)
mg, _ = lofo(G, feats)
assert not is_valid(mg, N, 32), "на шумі модель не повинна проходити"
print("3  OK  на шумі is_valid=False")

# 4. years_to: швидший ліс (більше листяного) -> менше років
fast = years_to(m, dict(dnbr=0.0, decid_share=2.0, noise_feat=0.0), 0.8)
slow = years_to(m, dict(dnbr=0.0, decid_share=-2.0, noise_feat=0.0), 0.8)
print("4  роки до 80%%: листяний %.1f, хвойний %.1f" % (fast, slow))
assert fast < slow

# 5. build_fire_table з сирими точками (як у GEE-експорті)
pts = pd.DataFrame(dict(
    fire_id=["a"] * 6 + ["b"] * 6, site="bc", fireYear=[2000] * 6 + [1995] * 6, gediYear=2020,
    rh98=[8, 9, 10, 7, 8, 9, 12, 13, 11, 12, 14, 12], ref_rh98_med=15.0, ref_rh98_n=500,
    ref_frac_decid=0.1, ref_frac_mixed=0.1, dnbr=300, dist_edge_m=100, sum_tmax_c=20, sum_def_mm=50,
    soil_org_c=15, fire_ha=1000))
T = build_fire_table(pts)
assert len(T) == 2 and set(T.fire_id) == {"a", "b"} and abs(T.set_index("fire_id").loc["a", "age"] - 20) < 1e-9
assert abs(T.set_index("fire_id").loc["a", "decid_share"] - 0.2) < 1e-9
print("5  OK  таблиця пожеж зібрана")
print("\nВсі перевірки пройшли")
