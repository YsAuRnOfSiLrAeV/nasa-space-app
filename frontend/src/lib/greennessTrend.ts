import type { NdviYear } from '../data/recoverySchema';
import { pearson } from './stats';

/** OLS slope of burned-minus-reference summer NDVI after the fire year.
 * Newey–West/Bartlett HAC covariance uses calendar-year lags, preserving gaps.
 * The normal 95% interval is exploratory and conditional on a linear trend.
 * https://www.statsmodels.org/stable/generated/statsmodels.stats.sandwich_covariance.cov_hac.html
 */
export function greennessTrend(rows: NdviYear[], fireYear: number) {
  const paired = rows
    .filter((row) => row.year > fireYear && row.burned && row.reference)
    .map((row) => ({ year: row.year, value: row.burned!.median - row.reference!.median }))
    .sort((a, b) => a.year - b.year);
  if (paired.length < 3) return null;
  if (new Set(paired.map((row) => row.year)).size !== paired.length)
    throw new Error('Trend input contains duplicate years.');
  const n = paired.length;
  const meanYear = paired.reduce((sum, row) => sum + row.year, 0) / n;
  const meanValue = paired.reduce((sum, row) => sum + row.value, 0) / n;
  const sxx = paired.reduce((sum, row) => sum + (row.year - meanYear) ** 2, 0);
  const slope =
    paired.reduce((sum, row) => sum + (row.year - meanYear) * (row.value - meanValue), 0) / sxx;
  const residuals = paired.map((row) => row.value - meanValue - slope * (row.year - meanYear));
  const score = paired.map((row, index) => (row.year - meanYear) * residuals[index]!);
  const lags = Math.min(n - 1, Math.floor(4 * (n / 100) ** (2 / 9)));
  let covariance = score.reduce((sum, value) => sum + value ** 2, 0);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const lag = paired[j]!.year - paired[i]!.year;
      if (lag > lags) break;
      covariance += 2 * (1 - lag / (lags + 1)) * score[i]! * score[j]!;
    }
  }
  const se = Math.sqrt(Math.max(0, (covariance * n) / (n - 2))) / sxx;
  return {
    slope,
    interval: [slope - 1.96 * se, slope + 1.96 * se] as [number, number],
    n,
    from: paired[0]!.year,
    to: paired.at(-1)!.year,
    lags,
    missing: paired.at(-1)!.year - paired[0]!.year + 1 - n,
    residualLag1: residualCorrelation(
      paired.map((row) => row.year),
      residuals,
    ),
  };
}

function residualCorrelation(years: number[], residuals: number[]): number | null {
  const left: number[] = [];
  const right: number[] = [];
  for (let index = 1; index < years.length; index++) {
    if (years[index]! - years[index - 1]! !== 1) continue;
    left.push(residuals[index - 1]!);
    right.push(residuals[index]!);
  }
  if (left.length < 3 || residuals.every((value) => Math.abs(value) < 1e-10)) return null;
  const correlation = pearson(left, right);
  return Number.isFinite(correlation) ? correlation : null;
}
