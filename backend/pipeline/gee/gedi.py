"""Reference ("100% recovery") forest height from GEDI. Owner: Misha.

GEDI shots in the 1.5-6 km ring around the WHOLE fire, unburned forest only, quality filters,
median rh98. GEDI only reaches 51.6 N; north of that use ETH Canopy Height, flagged as approximate.
"""

from __future__ import annotations

RING_INNER_M = 1500
RING_OUTER_M = 6000


def reference_height(fire_polygon) -> dict:
    """Return the reference height (m), its source ("GEDI" / "ETH") and the GEDI points used."""
    raise NotImplementedError
