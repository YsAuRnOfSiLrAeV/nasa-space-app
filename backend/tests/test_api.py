"""The fire catalog and the API on a small synthetic catalog: no real data, no pipeline, no network."""

import json
import time
from datetime import date

import numpy as np
import pyarrow as pa
import pyarrow.parquet as pq
import pytest
import shapely
from fastapi.testclient import TestClient
from shapely.geometry import MultiPolygon, box, mapping

from api.main import create_app
from api.settings import Settings
from catalog import packed
from catalog.fires import Filters, FireCatalog
from catalog.regions import Regions

PIXEL_DEG = packed.PIXEL_M / packed.EARTH_RADIUS_M * 180 / np.pi


def pixel_box(col: int, row: int, width: int, height: int):
    """A rectangle whose corners sit exactly on the MODIS pixel grid, like real perimeters."""
    corners = [(col, row), (col + width, row), (col + width, row + height), (col, row + height)]
    lonlat = packed._to_degrees(np.array([c[0] for c in corners]), np.array([c[1] for c in corners]))
    return shapely.Polygon(lonlat)


# The model region: a square around 51°N, 120°W. Tier A in the west half, tier B in the east half.
REGION_A = box(-121.0, 50.5, -120.0, 51.5)
REGION_B = box(-120.0, 50.5, -119.0, 51.5)

ROW_51N = round(51.0 / PIXEL_DEG)
COL_120W = round(-120.5 * np.cos(np.radians(51.0)) / PIXEL_DEG)
BIG = pixel_box(COL_120W, ROW_51N, 20, 20)  # about 86 km2, tier A
SMALL = pixel_box(COL_120W + 40, ROW_51N + 30, 2, 2)  # under 1 km2, tier A
EAST = pixel_box(COL_120W + 110, ROW_51N, 6, 6)  # tier B
TWO_PARTS = MultiPolygon([pixel_box(COL_120W - 30, ROW_51N - 40, 3, 3), pixel_box(COL_120W - 20, ROW_51N - 40, 3, 3)])
FIRES = [
    # fire_ID, geometry, size km2, start, end, tier
    (30000001, BIG, 86.0, date(2003, 8, 1), date(2003, 8, 20), "A"),
    (30000002, SMALL, 0.86, date(2003, 7, 4), date(2003, 7, 4), "A"),
    (150000003, EAST, 7.7, date(2015, 6, 10), date(2015, 6, 18), "B"),
    (260000004, TWO_PARTS, 3.9, date(2026, 5, 2), date(2026, 5, 5), "A"),
]


def write_year(path, fires):
    geometries = np.array([f[1] for f in fires], dtype=object)
    centres = shapely.centroid(geometries)
    table = pa.table(
        {
            "fire_ID": pa.array([f[0] for f in fires], type=pa.int32()),
            "lat": pa.array(shapely.get_y(centres), type=pa.float32()),
            "lon": pa.array(shapely.get_x(centres), type=pa.float32()),
            "size": pa.array([f[2] for f in fires], type=pa.float32()),
            "start_date": pa.array([f[3] for f in fires], type=pa.date32()),
            "end_date": pa.array([f[4] for f in fires], type=pa.date32()),
            "tier": pa.array([f[5] for f in fires]).dictionary_encode(),
            **packed.encode_geometry(geometries),
        }
    )
    pq.write_table(table, path, row_group_size=2)  # several row groups, as in the real files


@pytest.fixture(scope="module")
def data(tmp_path_factory):
    root = tmp_path_factory.mktemp("data")
    (root / "gfa").mkdir()
    (root / "regions").mkdir()
    (root / "fires").mkdir()
    write_year(root / "gfa" / "gfa_2003.parquet", FIRES[:2])
    write_year(root / "gfa" / "gfa_2026.parquet", FIRES[2:])
    for name, tier, region in (("covered", "A", REGION_A), ("extended", "B", REGION_B)):
        feature = {"type": "Feature", "properties": {"tier": tier}, "geometry": mapping(region)}
        (root / "regions" / f"{name}.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": [feature]}))
    return root


# ---- packed format and catalog ---------------------------------------------------------------


def test_packed_geometry_round_trip_and_bounds():
    geometries = np.array([BIG, TWO_PARTS, SMALL], dtype=object)
    table = pa.table(packed.encode_geometry(geometries))
    decoded = packed.decode_geometry(table)
    assert [g.geom_type for g in decoded] == ["Polygon", "MultiPolygon", "Polygon"]
    assert shapely.equals_exact(decoded, geometries, 1e-9).all()
    assert np.allclose(packed.bounds(table), shapely.bounds(geometries), atol=1e-9)
    # a slice of a table decodes too: this is how single fires are read
    assert shapely.equals_exact(packed.decode_geometry(table.slice(1, 2)), geometries[1:], 1e-9).all()


def test_off_grid_geometry_is_kept_exactly():
    odd = box(10.00001, 20.00002, 10.3, 20.4)  # not on the pixel grid
    table = pa.table(packed.encode_geometry(np.array([odd, BIG], dtype=object)))
    assert table["exact_wkb"].null_count == 1
    assert packed.decode_geometry(table)[0].equals(odd)
    assert np.allclose(packed.bounds(table)[0], odd.bounds)


def test_catalog_search_and_filters(data):
    catalog = FireCatalog(data / "gfa")
    assert len(catalog) == 4 and catalog.years == (2003, 2026)

    everything = catalog.search(box(-121, 50.5, -119, 51.5))
    assert [f.id for f in everything.fires] == ["gfa_30000001", "gfa_150000003", "gfa_260000004", "gfa_30000002"]  # largest first
    assert everything.total == 4 and not everything.truncated

    big = everything.fires[0]
    assert (big.year, big.start_date, big.end_date, big.area_ha, big.tier) == (2003, "2003-08-01", "2003-08-20", 8600.0, "A")
    assert big.geometry.equals_exact(BIG, 1e-9) and big.perimeter["type"] == "Polygon"

    assert [f.id for f in catalog.search(EAST.buffer(0.01)).fires] == ["gfa_150000003"]
    assert catalog.search(box(0, 0, 1, 1)).total == 0
    area = box(-121, 50.5, -119, 51.5)
    assert [f.year for f in catalog.search(area, Filters(year_from=2010)).fires] == [2015, 2026]
    assert [f.year for f in catalog.search(area, Filters(year_to=2003, min_area_ha=1000)).fires] == [2003]
    assert len(catalog.search(area, limit=2).fires) == 2 and catalog.search(area, limit=2).total == 4


def test_search_is_exact_not_by_bounding_box(data):
    # Between the two parts of TWO_PARTS: inside its bounding box, but touching neither part.
    west, south, east, north = TWO_PARTS.bounds
    gap = box(west + (east - west) * 0.45, south, west + (east - west) * 0.55, north)
    assert not gap.intersects(TWO_PARTS)
    assert FireCatalog(data / "gfa").search(gap).total == 0


def test_catalog_get_and_saved_index(data):
    catalog = FireCatalog(data / "gfa")
    assert (data / "gfa" / "index.npz").exists()
    assert FireCatalog(data / "gfa").get("gfa_260000004").geometry.geom_type == "MultiPolygon"  # from the saved index
    assert catalog.get("gfa_30000002").geometry.equals_exact(SMALL, 1e-9)
    assert catalog.get("gfa_999") is None and catalog.get("bc_2003_490") is None


def test_regions_tiers_and_shares(data):
    regions = Regions.load(sorted((data / "regions").glob("*.geojson")))
    assert list(regions.tier_of(np.array([BIG, EAST, box(0, 0, 1, 1), box(-120.2, 51, -119.8, 51.1)], dtype=object))) == ["A", "B", None, "A"]
    assert regions.tier_shares(box(-120.5, 50.8, -119.5, 51.2)) == {"A": 0.5, "B": 0.5}
    assert regions.tier_shares(box(-121.5, 50.8, -120.5, 51.2)) == {"A": 0.5}
    assert regions.tier_shares(box(0, 0, 1, 1)) == {}


# ---- API -------------------------------------------------------------------------------------


def make_client(data, compute):
    settings = Settings(data / "gfa", data / "regions", data / "fires", ("http://localhost:5173",), None)
    return TestClient(create_app(settings, compute))


def fake_pipeline(fire, summer, out_dir, on_step):
    for step in ("grid", "data", "files"):
        on_step(step)
    folder = out_dir / fire.id
    folder.mkdir(parents=True, exist_ok=True)
    (folder / "result.json").write_text(json.dumps({"fire": {"id": fire.id}, "satellite_images": {"summer": summer}}))
    (folder / "cells.json").write_text("{}")


@pytest.fixture()
def client(data):
    return make_client(data, fake_pipeline)


def search(client, area, **filters):
    return client.post("/fires/search", json={"polygon": mapping(area), **filters})


def test_search_states(client):
    assert client.get("/health").json() == {"status": "ok"}

    outside = search(client, box(0, 0, 1, 1)).json()
    assert outside["status"] == "outside_regions" and outside["fires"] == []

    empty = search(client, box(-120.9, 51.3, -120.8, 51.4)).json()
    assert empty["status"] == "no_fires" and empty["regions"] == {"A": 1.0} and empty["total"] == 0

    found = search(client, box(-121, 50.5, -119, 51.5)).json()
    assert found["status"] == "ok" and found["total"] == 4 and found["regions"] == {"A": 0.5, "B": 0.5}
    first = found["fires"][0]
    assert first["id"] == "gfa_30000001" and first["overlap"] == 1.0 and first["perimeter"]["type"] == "Polygon"
    assert set(first) == {"id", "year", "start_date", "end_date", "area_ha", "center", "tier", "perimeter", "overlap"}

    filtered = search(client, box(-121, 50.5, -119, 51.5), year_from=2010, min_area_ha=500).json()
    assert [f["id"] for f in filtered["fires"]] == ["gfa_150000003"]


def test_search_reports_how_much_of_the_fire_is_inside(client):
    west, south, east, north = BIG.bounds
    half = box(west - 1, south - 1, (west + east) / 2, north + 1)
    assert search(client, half).json()["fires"][0]["overlap"] == pytest.approx(0.5, abs=0.02)


def test_search_rejects_bad_polygons(client):
    bowtie = {"type": "Polygon", "coordinates": [[[0, 0], [1, 1], [1, 0], [0, 1], [0, 0]]]}
    assert client.post("/fires/search", json={"polygon": bowtie}).json()["code"] == "INVALID_POLYGON"
    assert client.post("/fires/search", json={"polygon": {"type": "Point", "coordinates": [0, 0]}}).status_code == 422
    huge = search(client, box(-140, 40, -60, 70))
    assert huge.status_code == 422 and huge.json()["code"] == "AREA_TOO_LARGE"
    assert search(client, box(-121, 50.5, -119, 51.5), limit=0).status_code == 422


def test_fire_and_summers(client):
    fire = client.get("/fires/gfa_150000003").json()
    assert fire["year"] == 2015 and fire["tier"] == "B" and "overlap" not in fire
    assert client.get("/fires/gfa_1").json()["code"] == "FIRE_NOT_FOUND"
    assert client.get("/summers", params={"fire_id": "gfa_150000003"}).json() == {"summers": [2026]}
    # a fire of 2026 has no later summer to be analysed for
    assert client.get("/summers", params={"fire_id": "gfa_260000004"}).json() == {"summers": []}


def wait_for(client, run_id):
    for _ in range(100):
        run = client.get(f"/runs/{run_id}").json()
        if run["status"] != "pending":
            return run
        time.sleep(0.05)
    raise AssertionError("run did not finish")


def test_run_to_result(client):
    started = client.post("/runs", json={"fire_id": "gfa_30000001", "summer": 2026}).json()
    assert started["status"] in ("pending", "complete") and started["id"] == "gfa_30000001-2026"

    done = wait_for(client, started["id"])
    assert done["status"] == "complete" and done["result"].endswith("/results/gfa_30000001/result.json")
    result = client.get("/results/gfa_30000001/result.json").json()
    assert result["satellite_images"]["summer"] == 2026
    assert client.get("/results/gfa_30000001/cells.json").status_code == 200
    assert client.get("/results/gfa_30000001/optical.png").json()["code"] == "RESULT_NOT_FOUND"
    assert client.get("/results/gfa_30000001/..%2Fsecret").status_code == 404


def test_computed_fire_is_not_computed_again(data, client):
    wait_for(client, client.post("/runs", json={"fire_id": "gfa_30000001", "summer": 2026}).json()["id"])

    def must_not_run(*_args):
        raise AssertionError("the pipeline ran again")

    restarted = make_client(data, must_not_run)  # a new process: only the files remain
    assert restarted.post("/runs", json={"fire_id": "gfa_30000001", "summer": 2026}).json()["status"] == "complete"
    assert restarted.get("/runs/gfa_30000001-2026").json()["status"] == "complete"


def test_run_errors(data):
    class NisarUnavailable(RuntimeError):
        pass

    def failing(*_args):
        raise NisarUnavailable("no ascending NISAR granules over the fire for this summer")

    client = make_client(data, failing)
    assert client.post("/runs", json={"fire_id": "gfa_1", "summer": 2026}).json()["code"] == "FIRE_NOT_FOUND"
    assert client.post("/runs", json={"fire_id": "gfa_150000003", "summer": 2020}).json()["code"] == "SUMMER_UNAVAILABLE"
    assert client.get("/runs/nope-2026").json()["code"] == "RUN_NOT_FOUND"

    failed = wait_for(client, client.post("/runs", json={"fire_id": "gfa_150000003", "summer": 2026}).json()["id"])
    assert failed == {"status": "failed", "id": "gfa_150000003-2026", "code": "NISAR_UNAVAILABLE", "message": "no ascending NISAR granules over the fire for this summer"}


def test_missing_catalog_is_a_clear_error(tmp_path, data):
    settings = Settings(tmp_path / "nothing", data / "regions", tmp_path, (), None)
    response = search(TestClient(create_app(settings, fake_pipeline)), box(-121, 50.5, -119, 51.5))
    assert response.status_code == 503 and response.json()["code"] == "CATALOG_MISSING"
