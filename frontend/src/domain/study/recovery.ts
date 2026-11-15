/**
 * Forest Recovery page logic (pure, tested). Everything here is computed from
 * the loaded points: nothing is interpolated, extrapolated or filled in.
 *
 * Each point has one observation per sensor (see
 * plan_documentation/FOREST_RECOVERY_DATA_AUDIT.md), so "recovery over time" is
 * shown by comparing groups of different fire ages (space-for-time), never as
 * a time series of one place.
 */
import { median } from 'd3-array';
import type { RecoveryFile, RecoveryImage } from '@/data/recoverySchema';
import type { LocatedPoint, Manifest } from '@/data/schema';
import type { BurnGroup } from './burnGroups';

/** MODIS MCD12Q1 IGBP land-cover classes that occur in this dataset. */
export const IGBP_LABELS: Record<number, string> = {
  1: 'Evergreen needleleaf forest',
  2: 'Evergreen broadleaf forest',
  3: 'Deciduous needleleaf forest',
  4: 'Deciduous broadleaf forest',
  5: 'Mixed forest',
  6: 'Closed shrubland',
  7: 'Open shrubland',
  8: 'Woody savanna',
  9: 'Savanna',
  10: 'Grassland',
  11: 'Permanent wetland',
};

export interface ClassCount {
  code: number;
  label: string;
  n: number;
}

export interface GroupRecovery {
  group: BurnGroup;
  points: LocatedPoint[];
  /** GEDI shot years present in the group, ascending. */
  gediYears: number[];
  /** Burn age when the lidar was taken: [youngest, oldest] in years. */
  ageAtGedi: [number, number];
  /** NISAR acquisition dates used by the group's points, ascending. */
  nisarDates: string[];
  /** Pre-fire land cover (MODIS 2001), most common first. */
  preFireClasses: ClassCount[];
  /** Median Hansen tree cover in 2000, percent. */
  treeCover2000Pct: number;
  /** Medians of the 2026 snapshot. */
  ndvi: number;
  nisarHvDb: number;
  s1VhDb: number;
}

const uniqSorted = <T extends number | string>(xs: T[]) =>
  [...new Set(xs)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

export function groupRecovery(group: BurnGroup, located: LocatedPoint[]): GroupRecovery {
  const points = located.filter((p) => p.status === 'burned' && p.group_id === group.id);
  const classes = new Map<number, number>();
  for (const p of points) classes.set(p.lc2001, (classes.get(p.lc2001) ?? 0) + 1);
  const ages = points.flatMap((p) => (p.age_at_gedi_years === null ? [] : [p.age_at_gedi_years]));
  return {
    group,
    points,
    gediYears: uniqSorted(points.map((p) => p.gedi_year)),
    ageAtGedi: [Math.min(...ages), Math.max(...ages)],
    nisarDates: uniqSorted(points.flatMap((p) => (p.nisar_date ? [p.nisar_date] : []))),
    preFireClasses: [...classes.entries()]
      .map(([code, n]) => ({ code, label: IGBP_LABELS[code] ?? `IGBP class ${code}`, n }))
      .sort((a, b) => b.n - a.n || a.code - b.code),
    treeCover2000Pct: median(points, (p) => p.treecover2000_pct) ?? 0,
    ndvi: median(points, (p) => p.ndvi) ?? 0,
    nisarHvDb: median(points, (p) => p.nisar_hv_db) ?? 0,
    s1VhDb: median(points, (p) => p.s1_vh_db) ?? 0,
  };
}

/* ------------------------------------------------------------------ */
/* Observation timeline: only years in which something was observed.  */
/* ------------------------------------------------------------------ */

export interface TimelineEvent {
  year: number;
  label: string;
}

export interface TimelineLane {
  id: string;
  label: string;
  source: string;
  events: TimelineEvent[];
  /** Shown instead of events when the lane has none. */
  empty?: string;
}

export const TIMELINE_START = 2000;

const PLATFORM_LABEL: Record<string, string> = {
  'landsat-5': 'Landsat 5',
  'landsat-7': 'Landsat 7',
  'landsat-8': 'Landsat 8',
  'landsat-9': 'Landsat 9',
  'modis-terra': 'MODIS/Terra',
};
export const platformLabel = (p: string) => PLATFORM_LABEL[p] ?? p;

/**
 * Lanes for the observation timeline. `landsat` is the group's optional Landsat
 * file: when it is null the imagery and NDVI-history lanes say so instead.
 */
export function observationTimeline(
  r: GroupRecovery,
  manifest: Manifest,
  landsat: RecoveryFile | null = null,
): TimelineLane[] {
  const ref = manifest.reference_year;
  const gediCounts = new Map<number, number>();
  for (const p of r.points) gediCounts.set(p.gedi_year, (gediCounts.get(p.gedi_year) ?? 0) + 1);
  return [
    {
      id: 'imagery',
      label: 'Satellite imagery',
      source: 'Landsat C2 L2',
      events: (landsat?.images ?? []).map((img) => ({
        year: Number(img.date.slice(0, 4)),
        label: `${img.date}, ${platformLabel(img.platform)}, ${Math.round(img.clear_share * 100)}% of points clear`,
      })),
      empty: landsat ? 'No clear scene in any year' : 'No imagery loaded for this group',
    },
    {
      id: 'landsat-ndvi',
      label: 'Greenness history',
      source: 'Landsat NDVI, summer',
      events: (landsat?.ndvi ?? []).flatMap((y) =>
        y.burned
          ? [
              {
                year: y.year,
                label: `median ${y.burned.median.toFixed(2)} from ${y.burned.n_points} points`,
              },
            ]
          : [],
      ),
      empty: landsat ? 'No clear summer observation' : 'Not loaded for this group',
    },
    {
      id: 'precover',
      label: 'Pre-fire cover',
      source: 'Hansen 2000 · MODIS 2001',
      events: [
        { year: 2000, label: `Tree cover ${Math.round(r.treeCover2000Pct)}% (median)` },
        { year: 2001, label: `Land cover: ${r.preFireClasses[0]?.label ?? 'unknown'}` },
      ],
    },
    {
      id: 'fire',
      label: 'Fire',
      source: 'MODIS MCD64A1',
      events: [{ year: r.group.fireYear, label: `Burned in ${r.group.fireYear}` }],
    },
    {
      id: 'gedi',
      label: 'Canopy height',
      source: 'GEDI L2A lidar',
      events: [...gediCounts.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([year, n]) => ({ year, label: `${n} footprint${n === 1 ? '' : 's'}` })),
    },
    {
      id: 'ndvi',
      label: 'Greenness',
      source: 'Sentinel-2 NDVI',
      events: [{ year: ref, label: 'July–August composite' }],
    },
    {
      id: 's1',
      label: 'C-band radar',
      source: 'Sentinel-1',
      events: [{ year: ref, label: 'One acquisition window' }],
    },
    {
      id: 'nisar',
      label: 'L-band radar',
      source: 'NISAR GCOV',
      events: [{ year: ref, label: r.nisarDates.join(', ') || 'Date unknown' }],
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Measurements in one calendar year (beside the growth illustration). */
/* ------------------------------------------------------------------ */

/** First year with GEDI lidar data (launched December 2018, science data from April 2019). */
export const GEDI_FIRST_YEAR = 2019;

export interface YearObservation {
  source: string;
  text: string;
  /** False when the row states that nothing was measured. */
  measured: boolean;
}

export interface YearObservations {
  calendarYear: number;
  /** After the latest observations: nothing can have been measured. */
  future: boolean;
  rows: YearObservation[];
  /** The group's Landsat scene for that summer, if one was clear. */
  image: RecoveryImage | null;
}

/**
 * What was actually observed for a group in one calendar year. Every value is
 * read from the data; a source without a measurement says so (`measured:
 * false`) and nothing is filled in. Years after `referenceYear` have no rows.
 */
export function observationsForYear(
  r: GroupRecovery,
  landsat: RecoveryFile | null,
  calendarYear: number,
  referenceYear: number,
): YearObservations {
  const cal = calendarYear;
  if (cal > referenceYear) return { calendarYear: cal, future: true, rows: [], image: null };

  const rows: YearObservation[] = [];
  if (cal === r.group.fireYear) {
    rows.push({ source: 'MODIS MCD64A1', text: `Burned area mapped in ${cal}.`, measured: true });
  }

  const nd = landsat?.ndvi.find((y) => y.year === cal);
  rows.push(
    !landsat
      ? { source: 'Landsat NDVI', text: 'Not fetched for this group.', measured: false }
      : nd?.burned
        ? {
            source: `Landsat NDVI, ${nd.platforms.map(platformLabel).join(', ')}`,
            text: `Summer greenness ${nd.burned.median.toFixed(2)} at ${nd.burned.n_points} points${nd.reference ? `; unburned forest nearby ${nd.reference.median.toFixed(2)}` : ''}.`,
            measured: true,
          }
        : {
            source: 'Landsat NDVI',
            text: 'No clear summer observation this year.',
            measured: false,
          },
  );

  const shots = r.points.filter((p) => p.gedi_year === cal);
  rows.push(
    shots.length
      ? {
          source: 'GEDI L2A lidar',
          text: `${shots.length} footprint${shots.length === 1 ? '' : 's'} measured a median canopy height of ${median(shots, (p) => p.rh98_m)!.toFixed(1)} m.`,
          measured: true,
        }
      : {
          source: 'GEDI L2A lidar',
          text:
            cal < GEDI_FIRST_YEAR
              ? 'GEDI was not yet in orbit (data from 2019).'
              : 'No footprint in this group was measured this year.',
          measured: false,
        },
  );

  if (cal === referenceYear) {
    rows.push({
      source: 'NISAR · Sentinel-1 · Sentinel-2',
      text: `L-band HV ${r.nisarHvDb.toFixed(1)} dB, C-band VH ${r.s1VhDb.toFixed(1)} dB, NDVI ${r.ndvi.toFixed(2)} (group medians, ${referenceYear}).`,
      measured: true,
    });
  }

  const image = landsat?.images.find((i) => i.date.startsWith(`${cal}-`)) ?? null;
  return { calendarYear: cal, future: false, rows, image };
}

/** Calendar years with a group-level Landsat NDVI value, and years with GEDI footprints. */
export function observedYears(
  r: GroupRecovery,
  landsat: RecoveryFile | null,
): { ndvi: number[]; gedi: number[] } {
  return {
    ndvi: (landsat?.ndvi ?? []).filter((y) => y.burned).map((y) => y.year),
    gedi: r.gediYears,
  };
}

/* ------------------------------------------------------------------ */
/* Greenness recovery: the headline of a group with Landsat data.      */
/* ------------------------------------------------------------------ */

/** How close to its pre-fire difference from unburned forest counts as "back" (NDVI units). */
export const NDVI_RECOVERY_TOLERANCE = 0.02;

export interface NdviRecovery {
  /** Median summer NDVI of the burned group over the years before the fire. */
  before: number;
  /** Lowest burned value after the fire, and its year. */
  low: number;
  lowYear: number;
  /** Usual pre-fire difference burned − unburned (the burned area is rarely identical). */
  preFireGap: number;
  /**
   * First year after the low whose burned − unburned difference is back within
   * the tolerance of the pre-fire difference; null if that has not happened.
   */
  backYear: number | null;
  /** Latest year with both values. */
  lastYear: number;
}

/**
 * The greenness story of one group, read only from observed years. Returns
 * null when there is no pre-fire or post-fire observation to compare.
 * NDVI measures greenness, not trees: shrubs and grasses raise it too.
 */
export function ndviRecovery(file: RecoveryFile): NdviRecovery | null {
  const fire = file.fire_year;
  const both = file.ndvi.flatMap((y) =>
    y.burned && y.reference
      ? [{ year: y.year, burned: y.burned.median, gap: y.burned.median - y.reference.median }]
      : [],
  );
  const pre = both.filter((y) => y.year < fire);
  const post = both.filter((y) => y.year > fire);
  if (!pre.length || !post.length) return null;
  const lowest = post.reduce((a, b) => (b.burned < a.burned ? b : a));
  const preFireGap = median(pre, (y) => y.gap)!;
  const back = post.find(
    (y) => y.year > lowest.year && y.gap >= preFireGap - NDVI_RECOVERY_TOLERANCE,
  );
  return {
    before: median(pre, (y) => y.burned)!,
    low: lowest.burned,
    lowYear: lowest.year,
    preFireGap,
    backYear: back?.year ?? null,
    lastYear: post.at(-1)!.year,
  };
}

/* ------------------------------------------------------------------ */
/* Chronosequence: the same 2026 snapshot across fires of different age. */
/* ------------------------------------------------------------------ */

export type RecoveryMetric = 'rh98_m' | 'nisar_hv_db' | 's1_vh_db' | 'ndvi';

export interface MetricInfo {
  key: RecoveryMetric;
  title: string;
  unit: string;
  source: string;
  when: string;
  digits: number;
}

export const RECOVERY_METRICS: MetricInfo[] = [
  {
    key: 'rh98_m',
    title: 'Canopy height',
    unit: 'm',
    source: 'GEDI L2A rh98, lidar',
    when: 'one shot per point, 2019–2022',
    digits: 1,
  },
  {
    key: 'nisar_hv_db',
    title: 'L-band HV backscatter',
    unit: 'dB',
    source: 'NISAR GCOV',
    when: 'July 2026',
    digits: 1,
  },
  {
    key: 's1_vh_db',
    title: 'C-band VH backscatter',
    unit: 'dB',
    source: 'Sentinel-1 GRD',
    when: '2026',
    digits: 1,
  },
  {
    key: 'ndvi',
    title: 'Greenness (NDVI)',
    unit: '',
    source: 'Sentinel-2',
    when: 'July–August 2026',
    digits: 2,
  },
];

export interface ChronoColumn {
  /** Burn group id, or "reference" for unburned forest. */
  id: string;
  /** The group's name ("2011 B"); null for the reference. */
  label: string | null;
  fireYear: number | null;
  ageYears: number | null;
  values: number[];
  median: number;
}

/**
 * One column per burn group, youngest fire first, then the unburned reference.
 * Groups of equal age keep their own columns (they are different places).
 */
export function chronosequence(
  located: LocatedPoint[],
  groups: BurnGroup[],
  metric: RecoveryMetric,
): ChronoColumn[] {
  const byGroup = new Map<string, number[]>();
  const reference: number[] = [];
  for (const p of located) {
    if (p.status === 'unburned') reference.push(p[metric]);
    else (byGroup.get(p.group_id) ?? byGroup.set(p.group_id, []).get(p.group_id)!).push(p[metric]);
  }
  const cols: ChronoColumn[] = [...groups]
    .sort((a, b) => a.ageYears - b.ageYears || b.count - a.count || a.id.localeCompare(b.id))
    .map((g) => {
      const values = byGroup.get(g.id) ?? [];
      return {
        id: g.id,
        label: g.label,
        fireYear: g.fireYear,
        ageYears: g.ageYears,
        values,
        median: median(values) ?? 0,
      };
    });
  cols.push({
    id: 'reference',
    label: null,
    fireYear: null,
    ageYears: null,
    values: reference,
    median: median(reference) ?? 0,
  });
  return cols;
}
