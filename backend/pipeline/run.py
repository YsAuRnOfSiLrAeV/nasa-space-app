"""End-to-end: fire polygon + summer -> result files.

    python -m pipeline.run --fire <nbac_id> --summer 2026 --out ../data/fires

Steps of one run (each step works on maps on the same fire grid):

    grid    = make_grid(polygon)                                   grid.py
    nisar   = nisar_layers(grid, summer)                           nisar.py
    s1      = sentinel1(grid, summer)                              gee/layers.py
    nd      = ndvi(grid, summer)                                   gee/layers.py
    m       = masks(grid, summer)                                  gee/layers.py
    zones   = make_zones(polygon, grid, m)                         gee/zones.py
    ref     = reference_height(polygon, grid, zones)               gee/gedi.py
    cells   = build_table({**nisar.layers, **s1, **nd})            cell_features.py
    state   = state model on cells.values -> cells.to_grid(...)    model.py
    numbers = covariates, stage_share, coverage, optics_recovery   fire_stats.py
    future  = forecast model on fire year + numbers + ref          model.py
    write_fire(...), update_index(...)                             export.py
"""

from __future__ import annotations

import argparse


def run(polygon, summer: int, out_dir) -> None:
    raise NotImplementedError


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--fire", help="NBAC fire id")
    p.add_argument("--polygon", help="GeoJSON file with the fire polygon")
    p.add_argument("--summer", type=int, required=True, help="summer of the satellite images, e.g. 2026")
    p.add_argument("--out", required=True)
    p.parse_args()
    raise NotImplementedError


if __name__ == "__main__":
    main()
