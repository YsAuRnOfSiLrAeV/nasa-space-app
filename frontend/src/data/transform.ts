/**
 * Pure transformations from validated CSV rows to map-ready GeoJSON.
 * No I/O here, so it can be unit-tested and reused by the app if needed.
 */
import {
  REFERENCE_YEAR,
  SCHEMA_VERSION,
  STAGE_BREAKS_M,
  type Manifest,
  type PointCollection,
  type PointFeature,
  type RawRow,
  type Stage,
} from './schema';

export function stageFromHeight(heightM: number): Stage {
  if (heightM < STAGE_BREAKS_M[0]) return 0;
  if (heightM < STAGE_BREAKS_M[1]) return 1;
  return 2;
}

/** FNV-1a 32-bit. Deterministic, dependency-free, same result in Node and browser. */
function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Stable point ID derived from site + coordinates (not row order), so re-exports
 * or re-sorted CSVs keep the same IDs. Collisions are checked by the caller.
 */
export function makePointId(site: string, lat: number, lon: number): string {
  return `${site}-${fnv1a(`${site}|${lat.toFixed(6)}|${lon.toFixed(6)}`)}`;
}

/** NISAR granule names embed the start time as `_YYYYMMDDThhmmss_`. */
export function parseGranuleDate(granule: string): string | null {
  const m = /_(\d{4})(\d{2})(\d{2})T\d{6}_/.exec(granule);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

const round = (v: number, digits: number) => {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
};

export function rowToFeature(row: RawRow): PointFeature {
  const burned = row.cls === 1;
  const fireYear = burned ? row.fireYear : null;
  const lat = round(row.latitude, 6);
  const lon = round(row.longitude, 6);
  const id = makePointId(row.site, row.latitude, row.longitude);

  return {
    type: 'Feature',
    id,
    geometry: { type: 'Point', coordinates: [lon, lat] },
    properties: {
      point_id: id,
      site: row.site,
      group_id: row.fire_id,
      status: burned ? 'burned' : 'unburned',
      fire_year: fireYear,
      age_years: fireYear === null ? null : REFERENCE_YEAR - fireYear,
      age_at_gedi_years: fireYear === null ? null : row.gediYear - fireYear,
      gedi_year: row.gediYear,

      rh98_m: round(row.rh98, 2),
      lidar_stage: stageFromHeight(row.rh98),

      nisar_hv_db: round(row.nisar_HV, 3),
      nisar_hh_db: round(row.nisar_HH, 3),
      nisar_hv_minus_hh_db: round(row.nisar_HVmHH, 3),
      nisar_granule: row.nisar_granule,
      nisar_date: parseGranuleDate(row.nisar_granule),
      s1_vh_db: round(row.s1_VH, 3),
      s1_vv_db: round(row.s1_VV, 3),
      s1_vh_minus_vv_db: round(row.s1_VHmVV, 3),
      s1_angle_deg: round(row.s1_angle, 2),
      ndvi: round(row.NDVI, 4),

      lc2001: row.lc2001,
      treecover2000_pct: row.treecover2000,
      worldcover: row.worldcover,
      elev_m: round(row.elev, 1),
      slope_deg: round(row.slope, 2),
      rain_window_m: round(row.rain_window_m, 4),
    },
  };
}

export class DuplicatePointError extends Error {}

/** Sorted by point_id so output is byte-identical for identical input. */
export function buildCollection(rows: RawRow[]): PointCollection {
  const features = rows.map(rowToFeature);
  const seen = new Set<string>();
  for (const f of features) {
    if (seen.has(f.id)) {
      throw new DuplicatePointError(
        `Duplicate point_id ${f.id} at ${f.geometry.coordinates.join(', ')} (same site and coordinates)`,
      );
    }
    seen.add(f.id);
  }
  features.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { type: 'FeatureCollection', features };
}

export function buildManifest(collection: PointCollection, sources: Manifest['sources']): Manifest {
  const props = collection.features.map((f) => f.properties);
  const coords = collection.features.map((f) => f.geometry.coordinates);
  const burned = props.filter((p) => p.status === 'burned');
  const byStage: [number, number, number] = [0, 0, 0];
  for (const p of props) byStage[p.lidar_stage]++;

  const uniqSorted = <T extends string | number>(xs: T[]) =>
    [...new Set(xs)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const lons = coords.map((c) => c[0]);
  const lats = coords.map((c) => c[1]);

  return {
    schema_version: SCHEMA_VERSION,
    reference_year: REFERENCE_YEAR,
    stage_breaks_m: [...STAGE_BREAKS_M],
    sources,
    counts: {
      points: props.length,
      burned: burned.length,
      unburned: props.length - burned.length,
      burned_groups: new Set(burned.map((p) => p.group_id)).size,
      by_lidar_stage: byStage,
    },
    sites: uniqSorted(props.map((p) => p.site)),
    fire_years: uniqSorted(burned.map((p) => p.fire_year as number)),
    nisar_dates: uniqSorted(props.flatMap((p) => (p.nisar_date ? [p.nisar_date] : []))),
    bbox: [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)],
  };
}
