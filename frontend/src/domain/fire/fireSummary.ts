/**
 * Whole-fire results read from result.json, formatted for the investigation panel.
 * DOM-free and tested. A value is missing only when it is null or undefined:
 * 0 is a legitimate scientific value and is always shown as 0.
 */
import type { FireResult } from '@/data/fireSchema';
import { GRID_LAYERS } from './fireGrid';

export const UNAVAILABLE = 'Not available';

/** Supplied means present in the export: 0 counts, null and undefined do not. */
export function isProvided<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/** A fraction as a whole-number percentage ("0%" for 0, "<1%" for tiny shares). */
export function formatShare(value: number | null | undefined): string {
  if (!isProvided(value) || !Number.isFinite(value)) return UNAVAILABLE;
  if (value > 0 && value < 0.005) return '<1%';
  return `${Math.round(value * 100)}%`;
}

/** The model's validated error, exactly as supplied (percent). */
export function formatError(value: number | null | undefined): string {
  if (!isProvided(value) || !Number.isFinite(value)) return UNAVAILABLE;
  return `±${value}%`;
}

export interface StageSegment {
  label: string;
  /** Same token as the map's forest-stage layer. */
  token: string;
  share: number;
}

/** The three supplied stage shares, in map order and colours; null when not supplied. */
export function stageSegments(share: FireResult['model_result']['stage_share']) {
  if (!share) return null;
  const { categories, tokens } = GRID_LAYERS.stage;
  return share.map((value, i): StageSegment => ({
    label: categories[i]!,
    token: tokens[i]!,
    share: value,
  }));
}

/** Neighbouring ("100% recovery") forest height and the source it actually came from. */
export function neighbourForest(nf: FireResult['neighbour_forest']): {
  height: string;
  source: string;
} {
  if (!nf || !isProvided(nf.height_m)) {
    return { height: UNAVAILABLE, source: nf?.source ? sourceName(nf.source) : UNAVAILABLE };
  }
  return { height: `${nf.height_m} m`, source: sourceName(nf.source) };
}

function sourceName(source: string): string {
  const key = source.trim().toLowerCase();
  if (key === 'gedi') return 'GEDI lidar around the fire';
  if (key === 'eth') return 'ETH Global Canopy Height (approximate; used north of 51.6° N)';
  return source.trim() || UNAVAILABLE;
}

export type ComparisonKey = 'optics' | 'model' | 'lidar';
export interface ComparisonRow {
  key: ComparisonKey;
  label: string;
  basis: string;
  value: number;
}

const COMPARISON: Omit<ComparisonRow, 'value'>[] = [
  { key: 'optics', label: 'Optical greenness', basis: 'Sentinel-2 optical index' },
  { key: 'model', label: 'Modelled structure', basis: 'Radar model estimate' },
  { key: 'lidar', label: 'GEDI lidar', basis: 'Lidar heights inside the fire' },
];

/**
 * Optical / model / lidar recovery rows that were actually supplied. A comparison
 * needs at least two of them; otherwise there is nothing to compare.
 */
export function comparisonRows(comparison: FireResult['comparison']): {
  rows: ComparisonRow[];
  missing: string[];
  comparable: boolean;
} {
  const rows: ComparisonRow[] = [];
  const missing: string[] = [];
  for (const row of COMPARISON) {
    const value = comparison?.[row.key];
    if (isProvided(value)) rows.push({ ...row, value });
    else missing.push(row.label);
  }
  return { rows, missing, comparable: rows.length >= 2 };
}

/** Whole-fire results this export does not supply, named for the panel's explanation. */
export function missingResults(result: FireResult): string[] {
  const model = result.model_result;
  const missing: string[] = [];
  if (!isProvided(result.fire.area_ha)) missing.push('fire area');
  if (!isProvided(model.recovery_today_avg)) missing.push('whole-fire recovery');
  if (!isProvided(model.error_vs_lidar_pct)) missing.push('validated model error');
  if (!isProvided(model.area_recovered_80pct)) missing.push('area recovered to 80%');
  if (!model.stage_share) missing.push('forest-stage proportions');
  if (!isProvided(result.neighbour_forest?.height_m)) missing.push('neighbouring forest height');
  if (!comparisonRows(result.comparison).comparable)
    missing.push('optical / model / lidar comparison');
  if (!result.growth_forecast) missing.push('growth forecast');
  return missing;
}
