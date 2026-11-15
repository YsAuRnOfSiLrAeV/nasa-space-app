/**
 * Small, tested statistics helpers built on d3-array.
 * Kept pure so numbers shown in charts are reproducible in tests.
 */
import { mean, sum } from 'd3-array';

/** Pearson correlation. Returns NaN for fewer than 2 pairs or zero variance. */
export function pearson(xs: readonly number[], ys: readonly number[]): number {
  if (xs.length !== ys.length) throw new Error('pearson: arrays differ in length');
  if (xs.length < 2) return Number.NaN;
  const mx = mean(xs)!;
  const my = mean(ys)!;
  const cov = sum(xs, (x, i) => (x - mx) * (ys[i]! - my));
  const vx = sum(xs, (x) => (x - mx) ** 2);
  const vy = sum(ys, (y) => (y - my) ** 2);
  return vx === 0 || vy === 0 ? Number.NaN : cov / Math.sqrt(vx * vy);
}

/** 1-based ranks; ties get the average of their positions (same convention as pandas/scipy). */
export function averageRanks(values: readonly number[]): number[] {
  const order = values.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0]);
  const ranks = new Array<number>(values.length);
  for (let start = 0; start < order.length;) {
    let end = start;
    while (end + 1 < order.length && order[end + 1]![0] === order[start]![0]) end++;
    const avg = (start + end) / 2 + 1;
    for (let k = start; k <= end; k++) ranks[order[k]![1]] = avg;
    start = end + 1;
  }
  return ranks;
}

/** Spearman rank correlation (Pearson on average ranks). */
export function spearman(xs: readonly number[], ys: readonly number[]): number {
  return pearson(averageRanks(xs), averageRanks(ys));
}
