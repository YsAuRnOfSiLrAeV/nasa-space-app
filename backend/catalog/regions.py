"""Model regions: the ecoregions where the recovery model is verified (tier A) or extrapolated (tier B).

Each tier is merged into one territory and cut into small pieces behind a spatial index. A shape
overlaps the territory exactly when it overlaps at least one piece, and the index finds the few
candidate pieces without looking at the rest of the world.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import shapely
from shapely.geometry import shape
from shapely.geometry.base import BaseGeometry

# Regions are cut into pieces of at most this many vertices, so one overlap test is cheap.
PIECE_VERTICES = 200
TIER = "tier"


@dataclass(frozen=True)
class Regions:
    tree: shapely.STRtree
    tiers: np.ndarray  # tier of each piece in the tree, e.g. "A" or "B"

    @classmethod
    def load(cls, paths: list[Path]) -> Regions:
        """Regions from GeoJSON files whose features carry a ``tier`` property."""
        by_tier: dict[str, list[BaseGeometry]] = {}
        for path in paths:
            for feature in json.loads(Path(path).read_text(encoding="utf-8"))["features"]:
                by_tier.setdefault(feature["properties"][TIER], []).append(shape(feature["geometry"]))
        return cls.from_geometries(by_tier)

    @classmethod
    def from_geometries(cls, by_tier: dict[str, list[BaseGeometry]]) -> Regions:
        pieces, tiers = [], []
        for tier, geometries in sorted(by_tier.items()):
            # Some regions come as collections with stray points and lines: only polygons have area.
            parts = shapely.get_parts(shapely.get_parts(shapely.make_valid(np.array(geometries, dtype=object))))
            territory = shapely.union_all(parts[shapely.get_type_id(parts) == shapely.GeometryType.POLYGON])
            cut = _subdivide(territory)
            pieces += cut
            tiers += [tier] * len(cut)
        return cls(shapely.STRtree(pieces), np.array(tiers))

    def tier_of(self, geometries: np.ndarray) -> np.ndarray:
        """Best tier (A before B) among the regions each geometry overlaps, None where it overlaps none."""
        shape_index, piece = self.tree.query(_unwrapped(geometries), predicate="intersects")
        out = np.full(len(geometries), None, dtype=object)
        # Worst tier first, so the best one is written last and stays.
        for tier in sorted(set(self.tiers), reverse=True):
            out[shape_index[self.tiers[piece] == tier]] = tier
        return out

    def tier_shares(self, geometry: BaseGeometry) -> dict[str, float]:
        """Share of the geometry's area inside each tier, e.g. {"A": 0.4, "B": 0.6}. Tiers do not overlap here:
        area already counted for a better tier is not counted again."""
        if geometry.area == 0:
            return {}
        pieces = self.tree.query(geometry, predicate="intersects")
        shares, counted = {}, None
        for tier in sorted(set(self.tiers[pieces])):
            covered = shapely.union_all(shapely.intersection(self.tree.geometries[pieces[self.tiers[pieces] == tier]], geometry))
            new = covered if counted is None else covered.difference(counted)
            counted = covered if counted is None else counted.union(covered)
            shares[str(tier)] = round(new.area / geometry.area, 4)
        return shares


def _unwrapped(geometries: np.ndarray) -> np.ndarray:
    """Shapes that cross the 180° meridian have vertices at both -180 and +180 and so appear to span the
    whole globe. Move their western vertices east by 360°, so they are tested where they really are."""
    box = shapely.bounds(geometries)
    wrapped = box[:, 2] - box[:, 0] > 180
    if not wrapped.any():
        return geometries
    out = geometries.copy()
    out[wrapped] = shapely.transform(geometries[wrapped], lambda xy: np.column_stack([np.where(xy[:, 0] < 0, xy[:, 0] + 360, xy[:, 0]), xy[:, 1]]))
    return out


def _subdivide(territory: BaseGeometry) -> list[BaseGeometry]:
    """Split a (multi)polygon into pieces of at most PIECE_VERTICES vertices by halving its bounding box."""
    done, todo = [], list(shapely.get_parts(territory))
    while todo:
        piece = todo.pop()
        west, south, east, north = piece.bounds
        if shapely.get_num_coordinates(piece) <= PIECE_VERTICES or max(east - west, north - south) < 1e-6:
            done.append(piece)
            continue
        if east - west >= north - south:
            middle = (west + east) / 2
            halves = [shapely.box(west, south, middle, north), shapely.box(middle, south, east, north)]
        else:
            middle = (south + north) / 2
            halves = [shapely.box(west, south, east, middle), shapely.box(west, middle, east, north)]
        for half in halves:
            parts = shapely.get_parts(shapely.intersection(piece, half))
            todo += [part for part in parts if part.geom_type == "Polygon" and not part.is_empty]
    return done
