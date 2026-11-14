import { median } from 'd3-array';
import { z } from 'zod';
import type { RecoveryFile, NdviYear } from './recoverySchema';

export const APPEEARS_PRODUCT = 'MOD13Q1.061';
export const APPEEARS_NDVI = '_250m_16_days_NDVI';
export const APPEEARS_QA = '_250m_16_days_pixel_reliability';
export const APPEEARS_SEASON = { from: '07-01', to: '08-31' };
export const APPEEARS_POLICY =
  'MOD13Q1 pixel reliability = 0 (good data); fill values excluded; valid NDVI −0.2 to 1.';

const ProgressResponse = z.object({
  progress: z
    .object({
      summary: z.number(),
      details: z.array(z.object({ desc: z.string(), pct_complete: z.number() })),
    })
    .optional(),
});
// AppEEARS returns an object for a task, while older API examples show arrays.
export const AppEEARSProgressSchema = z
  .union([ProgressResponse, z.array(ProgressResponse)])
  .transform((value) => (Array.isArray(value) ? value[0]?.progress : value.progress));

export interface OpticalSamplePoint {
  id: string;
  latitude: number;
  longitude: number;
  category: 'burned' | 'reference';
}

export interface AppEEARSSelection {
  group_id: string;
  fire_year: number;
  years: [number, number];
  bbox: [number, number, number, number];
  reference_radius_km: number;
  coordinates: OpticalSamplePoint[];
}

export function appeearsRequest(selection: AppEEARSSelection) {
  return {
    task_type: 'point',
    task_name: `forest-recovery-${selection.group_id}`,
    params: {
      dates: [
        {
          startDate: APPEEARS_SEASON.from,
          endDate: APPEEARS_SEASON.to,
          recurring: true,
          yearRange: selection.years,
        },
      ],
      layers: [APPEEARS_NDVI, APPEEARS_QA].map((layer) => ({ product: APPEEARS_PRODUCT, layer })),
      coordinates: selection.coordinates,
    },
  };
}

function exportDate(text: string): string {
  let date = text.trim();
  const american = /^(\d{2})-(\d{2})-(\d{4})$/.exec(date);
  if (american) date = `${american[3]}-${american[1]}-${american[2]}`;
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(Date.parse(date)) ||
    new Date(date).toISOString().slice(0, 10) !== date
  ) {
    throw new Error(`Invalid AppEEARS date: ${text}`);
  }
  return date;
}

function column(fields: string[], name: string, suffix = false): string {
  const matches = fields.filter((field) =>
    suffix ? field.endsWith(name) : field.toLowerCase() === name.toLowerCase(),
  );
  if (matches.length !== 1)
    throw new Error(`Expected exactly one ${name} column in the AppEEARS CSV.`);
  return matches[0]!;
}

/** Units are explicit because an export may contain either scaled NDVI or raw DN. */
export function importAppEEARS(
  rows: Record<string, string>[],
  selection: AppEEARSSelection,
  units: 'raw' | 'scaled',
): RecoveryFile {
  if (rows.length === 0) throw new Error('The AppEEARS CSV contains no rows.');
  const fields = Object.keys(rows[0]!);
  const idColumn = column(fields, 'ID');
  const dateColumn = column(fields, 'Date');
  const valueColumn = column(
    fields,
    `${APPEEARS_PRODUCT.replace('.', '_')}_${APPEEARS_NDVI}`,
    true,
  );
  const qaColumn = column(fields, `${APPEEARS_PRODUCT.replace('.', '_')}_${APPEEARS_QA}`, true);
  const selectedIds = new Set(selection.coordinates.map((point) => point.id));
  const seen = new Set<string>();
  const samples = new Map<number, Map<string, number[]>>();
  const quality = new Map<number, { accepted: number; rejected: number; missing: number }>();
  for (const row of rows) {
    const id = row[idColumn]?.trim() ?? '';
    if (!selectedIds.has(id)) throw new Error(`AppEEARS point ${id} is not in the saved request.`);
    const date = exportDate(row[dateColumn] ?? '');
    const year = Number(date.slice(0, 4));
    if (
      year < selection.years[0] ||
      year > selection.years[1] ||
      date.slice(5) < APPEEARS_SEASON.from ||
      date.slice(5) > APPEEARS_SEASON.to
    )
      continue;
    const key = `${id}|${date}`;
    if (seen.has(key)) throw new Error(`Duplicate AppEEARS observation for ${id} on ${date}.`);
    seen.add(key);
    const counts = quality.get(year) ?? { accepted: 0, rejected: 0, missing: 0 };
    quality.set(year, counts);
    const rawText = row[valueColumn]?.trim();
    const qaText = row[qaColumn]?.trim();
    const raw = rawText ? Number(rawText) : Number.NaN;
    const qa = qaText ? Number(qaText) : Number.NaN;
    const value = units === 'raw' ? raw * 0.0001 : raw;
    if (!Number.isFinite(raw) || raw === -3000 || !Number.isFinite(qa) || qa === -1) {
      counts.missing++;
    } else if (qa !== 0 || value < -0.2 || value > 1) {
      counts.rejected++;
    } else {
      counts.accepted++;
      const points = samples.get(year) ?? new Map<string, number[]>();
      samples.set(year, points);
      const values = points.get(id) ?? [];
      values.push(value);
      points.set(id, values);
    }
  }
  const summarise = (year: number, category: OpticalSamplePoint['category']) => {
    const observations = selection.coordinates
      .filter((point) => point.category === category)
      .map((point) => samples.get(year)?.get(point.id) ?? [])
      .filter((values) => values.length > 0);
    return observations.length
      ? {
          median: median(observations.map((values) => median(values)!))!,
          n_points: observations.length,
          n_obs: observations.reduce((sum, values) => sum + values.length, 0),
        }
      : null;
  };
  const ndvi: NdviYear[] = [];
  for (let year = selection.years[0]; year <= selection.years[1]; year++) {
    const burned = summarise(year, 'burned');
    const reference = summarise(year, 'reference');
    ndvi.push({
      year,
      burned,
      reference,
      platforms: burned || reference ? ['modis-terra'] : [],
      quality: quality.get(year) ?? { accepted: 0, rejected: 0, missing: 0 },
    });
  }
  if (!ndvi.some((row) => row.burned || row.reference))
    throw new Error(
      'No summer NDVI observations passed quality checks. The existing output was preserved.',
    );
  return {
    schema_version: 1,
    group_id: selection.group_id,
    fire_year: selection.fire_year,
    bbox: selection.bbox,
    season: APPEEARS_SEASON,
    years: selection.years,
    reference: {
      point_ids: selection.coordinates
        .filter((point) => point.category === 'reference')
        .map((point) => point.id),
      max_distance_km: selection.reference_radius_km,
    },
    source: {
      collection: APPEEARS_PRODUCT,
      access: 'NASA AppEEARS',
      citation: 'NASA LP DAAC · MODIS/Terra MOD13Q1 Version 6.1',
      doi: ['10.5067/MODIS/MOD13Q1.061'],
      method:
        'July–August MODIS 250 m, 16-day composites. Each point’s median accepted NDVI, then the median across points. MODIS and Landsat records are processed and displayed separately.',
      quality_policy: APPEEARS_POLICY,
    },
    scenes: [],
    images: [],
    ndvi,
  };
}
