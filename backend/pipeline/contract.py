"""Feature table contract between the pipeline (Yaroslav, Misha) and forestrecovery (Sofia).

Each row is one grid cell, each column one feature. All arrays share the grid shape.
Invalid / missing value = NaN. Radar values are in dB, NDVI is 0..1.

Source of truth for date windows and input checks: forestrecovery.feature_spec() and
forestrecovery.input_report(). Do not rename columns without agreeing with the team.
"""

# Yaroslav, pipeline/nisar.py. Units: dB.
NISAR_HV = "nisar_HV"
NISAR_HH = "nisar_HH"

# Misha, pipeline/gee/layers.py.
S1_VH = "s1_VH"  # dB
S1_VV = "s1_VV"  # dB
NDVI = "NDVI"  # 0..1, not 0..10000

FEATURE_COLUMNS = (NISAR_HV, NISAR_HH, S1_VH, S1_VV, NDVI)

# HV-HH and VH-VV differences are computed inside forestrecovery; do not add them here.

# Zone codes in the zones array and in cells.json map.zone. Excluded cells are NaN (null in cells.json).
ZONE_BURN = 1
ZONE_REFERENCE = 0
