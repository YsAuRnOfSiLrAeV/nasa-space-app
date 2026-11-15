/**
 * Burn-scar groups summarised from the loaded points (pure, tested).
 * A group is the CSV `fire_id` cross-validation group (fire year + 0.25° cell),
 * not an official fire perimeter, and the UI must say so.
 */
import { mean, median } from 'd3-array';
import type { LocatedPoint } from '@/data/schema';

export interface BurnGroup {
  id: string;
  fireYear: number;
  /**
   * Name that tells groups apart: the fire year, plus a letter when several groups
   * burned that year ("2011 A" has the most points, then B, C…).
   */
  label: string;
  /** Years since the fire at radar acquisition (REFERENCE_YEAR - fire year). */
  ageYears: number;
  count: number;
  /** Centroid of member points [lon, lat]. */
  centroid: [number, number];
  medianHeightM: number;
  /** Share of points at stage 2 (>= 10 m), 0–1. */
  shareTall: number;
}

export function computeBurnGroups(points: LocatedPoint[]): BurnGroup[] {
  const groups = new Map<string, typeof points>();
  for (const p of points) {
    if (p.status !== 'burned' || p.fire_year === null) continue;
    const g = groups.get(p.group_id);
    if (g) g.push(p);
    else groups.set(p.group_id, [p]);
  }
  const sorted = [...groups.entries()]
    .map(([id, ps]) => ({
      id,
      fireYear: ps[0]!.fire_year as number,
      ageYears: ps[0]!.age_years ?? 0,
      count: ps.length,
      centroid: [mean(ps, (p) => p.lon)!, mean(ps, (p) => p.lat)!] as [number, number],
      medianHeightM: median(ps, (p) => p.rh98_m) ?? 0,
      shareTall: ps.filter((p) => p.lidar_stage === 2).length / ps.length,
    }))
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
  // Letters follow the sort (largest first), so they are stable for a given dataset.
  const perYear = new Map<number, number>();
  for (const g of sorted) perYear.set(g.fireYear, (perYear.get(g.fireYear) ?? 0) + 1);
  const seen = new Map<number, number>();
  return sorted.map((g) => {
    const i = seen.get(g.fireYear) ?? 0;
    seen.set(g.fireYear, i + 1);
    const several = (perYear.get(g.fireYear) ?? 1) > 1;
    return {
      ...g,
      label: several ? `${g.fireYear} ${String.fromCharCode(65 + i)}` : `${g.fireYear}`,
    };
  });
}
