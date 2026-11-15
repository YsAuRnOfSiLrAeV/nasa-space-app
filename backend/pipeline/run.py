"""End-to-end: fire polygon + year -> result files.

    python -m pipeline.run --fire <nbac_id> --year 2026 --out ../data/demo/<fire_id>
"""

from __future__ import annotations

import argparse


def run(polygon, year: int, out_dir) -> None:
    # grid = make_grid(polygon)
    # nisar = read_to_grid(find_scene(polygon, year), grid)
    # s1, nd, m = sentinel1(grid, year), ndvi(grid, year), masks(grid, year)
    # zones = make_zones(polygon, grid, m)
    # ref = reference_height(polygon, grid, zones)
    # table = build_table(nisar, s1, nd)
    # state = run_model(table, ref["height_m"])
    # write_result(out_dir, ...)
    raise NotImplementedError


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--fire", help="NBAC fire id")
    p.add_argument("--polygon", help="GeoJSON file with the fire polygon")
    p.add_argument("--year", type=int, required=True)
    p.add_argument("--out", required=True)
    p.parse_args()
    raise NotImplementedError


if __name__ == "__main__":
    main()
