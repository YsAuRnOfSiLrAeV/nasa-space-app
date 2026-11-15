/**
 * Landsat Collection 2 Level-2 helpers (pure, tested). Used by
 * scripts/fetch-landsat.ts to turn raw point samples into the per-year NDVI
 * summaries in public/data/recovery/<group>.json.
 */
import { median } from 'd3-array';
import type { NdviYear } from './recoverySchema';

/** C2 L2 surface reflectance: reflectance = DN × 0.0000275 − 0.2. */
export const SR_SCALE = 0.0000275;
export const SR_OFFSET = -0.2;

/**
 * QA_PIXEL bits that make a pixel unusable: 0 fill, 1 dilated cloud, 2 cirrus,
 * 3 cloud, 4 cloud shadow, 5 snow.
 */
export const QA_REJECT_MASK = 0b11_1111;

export const isClear = (qa: number) => (Math.round(qa) & QA_REJECT_MASK) === 0;

export const reflectance = (dn: number) => dn * SR_SCALE + SR_OFFSET;

/** NDVI from raw red / NIR DNs, or null if masked or out of the valid reflectance range. */
export function ndviFromSample(redDn: number, nirDn: number, qa: number): number | null {
  if (!isClear(qa)) return null;
  const red = reflectance(redDn);
  const nir = reflectance(nirDn);
  if (red <= 0 || nir <= 0 || red > 1 || nir > 1) return null;
  return (nir - red) / (nir + red);
}

export interface SceneRef {
  id: string;
  date: string;
  platform: string;
}

/** One point sampled in one scene: [red DN, NIR DN, QA_PIXEL]. */
export type Sample = [number, number, number];

export type Summary = NonNullable<NdviYear['burned']>;

/**
 * Per year: each point's median clear NDVI, then the median over points.
 * Years without any clear observation stay null (a gap, never filled).
 */
export function summariseNdvi(
  scenes: SceneRef[],
  samples: Record<string, Sample>,
  burnedIds: string[],
  referenceIds: string[],
  years: [number, number],
): NdviYear[] {
  const byYear = new Map<number, SceneRef[]>();
  for (const s of scenes) {
    const y = Number(s.date.slice(0, 4));
    (byYear.get(y) ?? byYear.set(y, []).get(y)!).push(s);
  }
  const summarise = (ids: string[], yearScenes: SceneRef[]) => {
    const perPoint: number[] = [];
    let nObs = 0;
    for (const id of ids) {
      const values: number[] = [];
      for (const s of yearScenes) {
        const smp = samples[`${s.id}|${id}`];
        const v = smp ? ndviFromSample(...smp) : null;
        if (v !== null) values.push(v);
      }
      if (values.length) {
        perPoint.push(median(values)!);
        nObs += values.length;
      }
    }
    return perPoint.length
      ? { median: round(median(perPoint)!, 4), n_points: perPoint.length, n_obs: nObs }
      : null;
  };
  const out: NdviYear[] = [];
  for (let y = years[0]; y <= years[1]; y++) {
    const ys = byYear.get(y) ?? [];
    const burned = summarise(burnedIds, ys);
    const reference = summarise(referenceIds, ys);
    const used = ys.filter((s) =>
      [...burnedIds, ...referenceIds].some((id) => {
        const smp = samples[`${s.id}|${id}`];
        return smp ? ndviFromSample(...smp) !== null : false;
      }),
    );
    out.push({
      year: y,
      platforms: [...new Set(used.map((s) => s.platform))].sort(),
      burned,
      reference,
    });
  }
  return out;
}

/** Share of the given points that are clear in a scene (missing samples count as not clear). */
export function clearShare(sceneId: string, ids: string[], samples: Record<string, Sample>) {
  if (!ids.length) return 0;
  const clear = ids.filter((id) => {
    const s = samples[`${sceneId}|${id}`];
    return s ? ndviFromSample(...s) !== null : false;
  }).length;
  return round(clear / ids.length, 4);
}

/**
 * NDVI axis range for drawing a record: at least 0.2 to 0.9 (so a calm record
 * does not look dramatic), widened to fit any value outside it. The headline
 * sparkline and the full chart use the same range.
 */
export function ndviDomain(rows: NdviYear[]): [number, number] {
  const values = rows
    .flatMap((r) => [r.burned?.median, r.reference?.median])
    .filter((v): v is number => v != null);
  return [Math.min(0.2, ...values), Math.max(0.9, ...values)];
}

/** Consecutive runs of years that have a value: a missing year breaks a drawn line. */
export function consecutiveRuns(rows: NdviYear[], key: 'burned' | 'reference'): NdviYear[][] {
  const out: NdviYear[][] = [];
  let cur: NdviYear[] = [];
  for (const r of rows) {
    if (r[key]) cur.push(r);
    else if (cur.length) {
      out.push(cur);
      cur = [];
    }
  }
  if (cur.length) out.push(cur);
  return out;
}

/** Landsat 7 lost its scan-line corrector on 2003-05-31; later scenes have data gaps. */
export const isSlcOff = (s: SceneRef) => s.platform === 'landsat-7' && s.date >= '2003-05-31';

function round(v: number, digits: number) {
  const k = 10 ** digits;
  return Math.round(v * k) / k;
}
