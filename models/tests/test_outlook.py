"""Текстові рекомендації (forestrecovery.outlook): Канада, Україна, Середземномор'я, савана, решта, поза територією."""
from forestrecovery import outlook

c = outlook(-120.2, 51.1, fire_year=2003)
assert c["kind"] == "growth_forecast" and c["available"] and 0 < c["numbers"]["now"] < c["numbers"]["in10"] < c["numbers"]["in20"] < c["numbers"]["in30"] < 100
assert "2003" in c["text"] and "%" in c["text"] and "типова" in c["text"] and "FORECAST_EXTRAPOLATES_BEYOND_AGE_36" in c["warnings"]
assert outlook(-120.2, 51.1)["warnings"] == ["NEED_FIRE_YEAR"] and "en" and "recover" in outlook(-120.2, 51.1, fire_year=2003, lang="en")["text"]
print("1 OK  Канада: відсотки через 10/20/30 років, рік 80%, позначка типової кривої й екстраполяції")

u = outlook(37.0, 49.5)
assert u["kind"] == "severity_scenario" and u["numbers"]["weak"] <= 100 and u["numbers"]["strong"] < u["numbers"]["weak"] and "не прогноз за роками" in u["text"]
us = outlook(37.0, 49.5, severity=0.5); assert us["numbers"]["lo"] <= us["numbers"]["level"] <= us["numbers"]["hi"] <= 100
m = outlook(-5.5, 40.0, severity=0.3); assert m["kind"] == "severity_scenario" and "Іспанія" in m["text"]
print("2 OK  Україна й Середземномор'я: сценарій від сили пожежі, рівні обмежені 100%")

assert outlook(25.2, -12.66)["kind"] == "none_savanna" and not outlook(25.2, -12.66)["available"]
assert outlook(10.5, 48.5)["kind"] == "state_only" and outlook(100, -60)["kind"] == "outside"
print("3 OK  савана, решта (стан без прогнозу), поза територією")
