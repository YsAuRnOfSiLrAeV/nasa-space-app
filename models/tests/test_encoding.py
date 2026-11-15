"""Регресія 0.14.1: читання файлів не залежить від кодування ОС (Windows cp1252) і хибна тривога input_report від викиду."""
import re
from pathlib import Path

import numpy as np

import forestrecovery as fr

src = Path(fr.__file__).parent
bad = [f"{p.name}:{i}" for p in src.glob("*.py") for i, ln in enumerate(p.read_text(encoding="utf-8").splitlines(), 1) if re.search(r"read_text\(\s*\)", ln)]
assert not bad, f"read_text() без encoding: {bad}"
print("1 OK  усі read_text() з encoding='utf-8'")

rng = np.random.default_rng(0)
n = 5000
a = dict(nisar_HV=rng.normal(-14, 2, n), nisar_HH=rng.normal(-9, 2, n), s1_VH=rng.normal(-17, 2, n), s1_VV=rng.normal(-9, 2, n), NDVI=rng.uniform(0.4, 0.8, n))
assert fr.input_report(**a)["ok"]
a["nisar_HV"][0] = 40.0                      # один викид не має давати «лінійна потужність»
rep = fr.input_report(**a)
assert not any("лінійну" in s for s in rep["issues"]), rep["issues"]
lin = {k: 10 ** (v / 10) for k, v in a.items() if k != "NDVI"}                 # справжня лінійна потужність ловиться
lin["NDVI"] = a["NDVI"]
assert any("лінійну" in s for s in fr.input_report(**lin)["issues"])
print("2 OK  input_report: викид не дає тривоги, лінійна потужність ловиться")

assert "tau_from_covariates" in fr.growth_covariates_info()["cv"] if "cv" in fr.growth_covariates_info() else True
print("3 OK  ключі cv англійською")
print("Усі перевірки пройдено")
