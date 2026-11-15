"""Build the fire catalog: Global Fire Atlas shapefiles (in their zip) -> packed Parquet, one file per year.

    python -m catalog.pack SHP_perimeters.zip ../data/gfa --regions ../data/regions/*.geojson

Only fires whose perimeter overlaps the model regions are kept, each with a ``tier`` column: the best
tier (A before B) among the regions it overlaps. Without --regions every fire is kept.

The zip is read in place, nothing is extracted. Every packed chunk is decoded and compared with
the original before it is written, so packing stops rather than lose data.
Needs the extra packages of `pip install -e ".[catalog]"`.
"""

from __future__ import annotations

import argparse
import re
import time
import zipfile
from pathlib import Path

import numpy as np
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
import shapely

from . import packed
from .regions import TIER, Regions

CHUNK = 200_000
ZSTD_LEVEL = 19
FLOAT_DECIMALS = 4  # DBF stores numbers as text with at most this many decimals
# Decoded coordinates must match the originals this closely, in degrees (about 0.1 mm).
MAX_ROUND_TRIP_DEG = 1e-9


def pack_layer(source: str, target: Path, regions: Regions | None = None) -> tuple[int, int]:
    """Pack one shapefile (any path GDAL can open) into one Parquet file. Returns (fires read, fires kept)."""
    import pyogrio

    total = pyogrio.read_info(source)["features"]
    kept = 0
    writer = None
    try:
        for skip in range(0, total, CHUNK):
            frame = pyogrio.read_dataframe(source, skip_features=skip, max_features=CHUNK)
            geometries = frame.geometry.values
            attributes = _compact(pd.DataFrame(frame.drop(columns="geometry")))
            if regions is not None:
                tier = regions.tier_of(np.asarray(geometries))
                inside = tier != None  # noqa: E711 - elementwise comparison on an object array
                geometries = np.asarray(geometries)[inside]
                attributes = attributes[inside].assign(**{TIER: tier[inside]})
                attributes[TIER] = attributes[TIER].astype("category")
            if not len(attributes):
                continue
            table = pa.Table.from_pandas(attributes, preserve_index=False)
            for name, column in packed.encode_geometry(np.asarray(geometries)).items():
                table = table.append_column(name, column)
            _check_round_trip(table, np.asarray(geometries))
            if writer is None:
                writer = pq.ParquetWriter(target, table.schema, compression="zstd", compression_level=ZSTD_LEVEL)
            writer.write_table(table.cast(writer.schema))
            kept += len(attributes)
    finally:
        if writer is not None:
            writer.close()
    return total, kept


def _compact(frame: pd.DataFrame) -> pd.DataFrame:
    """Same values in smaller types: dates as dates, 32-bit floats, text as categories.

    The rule depends only on the column type, never on the values, so every chunk gets the same schema.
    """
    out = frame.copy()
    for name, column in frame.items():
        if name.endswith("_date"):
            out[name] = pd.to_datetime(column).dt.date
        elif pd.api.types.is_float_dtype(column):
            out[name] = column.astype("float32")
        elif not pd.api.types.is_integer_dtype(column):
            out[name] = column.astype("category")
    return out


def _check_round_trip(table: pa.Table, original: np.ndarray) -> None:
    before = shapely.get_coordinates(original)
    after = shapely.get_coordinates(packed.decode_geometry(table))
    if before.shape != after.shape or np.abs(before - after).max() > MAX_ROUND_TRIP_DEG:
        raise ValueError("packed geometry does not decode back to the original")


def pack(archive: Path, out_dir: Path, years: list[int] | None, region_files: list[Path] | None) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    regions = Regions.load(region_files) if region_files else None
    with zipfile.ZipFile(archive) as z:
        layers = sorted(name for name in z.namelist() if name.endswith(".shp"))

    read_total = kept_total = 0
    for layer in layers:
        year = int(re.search(r"_(\d{4})\.shp$", layer).group(1))
        if years and year not in years:
            continue
        target = out_dir / f"gfa_{year}.parquet"
        started = time.time()
        fires, kept = pack_layer(f"/vsizip/{archive.as_posix()}/{layer}", target, regions)
        read_total, kept_total = read_total + fires, kept_total + kept
        size = target.stat().st_size / 1e6 if kept else 0
        print(f"{year}: {fires:>9,} fires, kept {kept:>9,} ({kept / fires:5.1%})  {size:6.1f} MB  {time.time() - started:.0f} s", flush=True)
    if read_total:
        print(f"total: {read_total:,} fires, kept {kept_total:,} ({kept_total / read_total:.1%})")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("archive", type=Path, help="zip with one perimeter shapefile per year")
    parser.add_argument("out_dir", type=Path)
    parser.add_argument("--years", type=int, nargs="*", help="only these years")
    parser.add_argument("--regions", type=Path, nargs="*", help="keep only fires overlapping these GeoJSON regions")
    args = parser.parse_args()
    pack(args.archive.resolve(), args.out_dir, args.years, args.regions)


if __name__ == "__main__":
    main()
