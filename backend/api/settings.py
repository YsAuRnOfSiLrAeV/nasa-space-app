"""Where the API finds its data. Every value can be overridden with an environment variable."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

DATA = Path(__file__).resolve().parents[2] / "data"

# Summers the pipeline can compute: NISAR science data starts in 2026.
SUMMERS = (2026,)


@dataclass(frozen=True)
class Settings:
    catalog_dir: Path  # packed fire files, *.parquet
    regions_dir: Path  # model regions, *.geojson with a `tier` property
    results_dir: Path  # computed fires: <fire id>/result.json, cells.json, optical.png
    allowed_origins: tuple[str, ...]  # sites that may call the API from a browser
    public_url: str | None  # address the browser reaches the API at, when it differs from the request's

    @classmethod
    def from_env(cls) -> Settings:
        origins = os.environ.get("API_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
        return cls(
            catalog_dir=Path(os.environ.get("FIRE_CATALOG_DIR", DATA / "gfa")),
            regions_dir=Path(os.environ.get("FIRE_REGIONS_DIR", DATA / "regions")),
            results_dir=Path(os.environ.get("FIRE_RESULTS_DIR", DATA / "fires")),
            allowed_origins=tuple(origin.strip() for origin in origins.split(",") if origin.strip()),
            public_url=os.environ.get("API_PUBLIC_URL") or None,
        )
