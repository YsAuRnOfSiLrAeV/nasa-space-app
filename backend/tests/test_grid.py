import numpy as np
import pytest
from shapely.geometry import Point, box

from pipeline.grid import CELL_M, RING_KM, make_grid, utm_epsg

# Rough boxes around two demo fires (lon/lat)
BC_2003 = box(-120.40, 51.01, -120.02, 51.21)
ONTARIO_1988 = box(-95.05, 49.80, -94.90, 50.03)


def test_utm_zone():
    assert make_grid(BC_2003).crs == "EPSG:32610"
    assert make_grid(ONTARIO_1988).crs == "EPSG:32615"
    assert utm_epsg(30.5, 50.4) == "EPSG:32636"    # Kyiv
    assert utm_epsg(-70.0, -33.0) == "EPSG:32719"  # southern hemisphere


def test_edges_are_multiples_of_cell():
    for v in make_grid(BC_2003).bounds:
        assert v % CELL_M == 0


def test_grid_covers_fire_plus_ring():
    g = make_grid(BC_2003)
    fl, fb, fr, ft = g.to_grid_crs(BC_2003).bounds
    l, b, r, t = g.bounds
    ring = RING_KM * 1000
    assert l <= fl - ring and r >= fr + ring and b <= fb - ring and t >= ft + ring


def test_two_grids_line_up():
    a, b = make_grid(BC_2003), make_grid(BC_2003.buffer(0.01))
    assert (a.transform.c - b.transform.c) % CELL_M == 0
    assert (a.transform.f - b.transform.f) % CELL_M == 0


def test_cell_centers():
    g = make_grid(ONTARIO_1988)
    x, y = g.cell_centers()
    assert x.shape == y.shape == g.shape
    assert x[0, 0] == g.transform.c + CELL_M / 2          # centre of the first cell
    assert x[0, 1] - x[0, 0] == CELL_M and y[0, 0] - y[1, 0] == CELL_M


def test_corners_surround_fire():
    lons, lats = zip(*make_grid(BC_2003).corners_lonlat())
    assert min(lons) < -120.40 and max(lons) > -120.02
    assert min(lats) < 51.01 and max(lats) > 51.21


def test_to_ee():
    g = make_grid(BC_2003)
    e = g.to_ee()
    assert e["crsCode"] == g.crs
    assert e["dimensions"] == {"width": g.width, "height": g.height}


def test_geojson_input_and_empty():
    g = make_grid({"type": "Polygon", "coordinates": [list(BC_2003.exterior.coords)]})
    arr = g.empty()
    assert arr.shape == g.shape and np.isnan(arr).all()


def test_rejects_bad_input():
    with pytest.raises(ValueError):
        make_grid(Point(0, 0))
    with pytest.raises(ValueError):
        make_grid(box(-120, 50, -100, 65))   # hundreds of millions of cells
