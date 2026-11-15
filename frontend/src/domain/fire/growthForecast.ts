/**
 * The supplied fire-level growth forecast (result.json `growth_forecast`), as a curve.
 * DOM-free and tested.
 *
 * Method `saturating_exp`: expected recovery, as a share of the neighbouring forest's
 * height, at fire age a is r(a) = 1 − exp(−a / τ). The contract supplies τ and the
 * milestones it implies (`years_to_80pct` = τ·ln 5, `year_80pct` = fire year +
 * years_to_80pct). The curve is accepted only when it reproduces the supplied
 * milestones, so the chart draws the supplied forecast rather than a guess.
 *
 * Nothing here is spatial: the forecast never recolours or reinterprets grid cells,
 * and uncertainty is displayed only when supplied. Bundle v2 uses model2.series
 * directly, as do v1 exports with growth_forecast.series. The legacy equation
 * applies only to older v1 exports without a supplied series.
 */
import type { FireResult } from '@/data/fireSchema';
import type { ForecastSeries } from '@/data/forecastSchema';

/** Tolerance for rounding in the supplied milestones. */
const YEARS_TOLERANCE = 0.5;
const MILESTONE_TOLERANCE = 1;
export const TARGET = 0.8;

export interface GrowthCurve {
  method: 'saturating_exp' | 'supplied_series';
  series?: ForecastSeries;
  seriesSource?: 'model2.series' | 'growth_forecast.series';
  tau?: number;
  fireYear: number;
  /** The observation summer: the grid's year, and the first forecast year. */
  summer: number;
  reliableAge: [number, number] | null;
  yearsTo80: number | null;
  year80: number | null;
  /** Slider and chart horizon. */
  endYear: number;
}

export type ForecastStatus =
  | { status: 'none' }
  | { status: 'unsupported'; reason: string }
  | { status: 'valid'; curve: GrowthCurve };

export function readForecast(
  result: FireResult,
  supplied?: import('@/data/bundleV2').BundleV2Data['source']['model2'],
): ForecastStatus {
  if (supplied) {
    if (supplied.forecast !== 'growth' || !supplied.series) return { status: 'none' };
    return {
      status: 'valid',
      curve: {
        method: 'supplied_series',
        series: supplied.series,
        seriesSource: 'model2.series',
        fireYear: result.fire.year,
        summer: result.satellite_images.summer,
        reliableAge: null,
        yearsTo80: supplied.years_to_80pct ?? null,
        year80: supplied.year_80pct ?? null,
        endYear: supplied.series.years.at(-1)!,
      },
    };
  }
  const f = result.growth_forecast;
  if (!f) return { status: 'none' };
  if (f.series)
    return {
      status: 'valid',
      curve: {
        method: 'supplied_series',
        series: f.series,
        seriesSource: 'growth_forecast.series',
        fireYear: result.fire.year,
        summer: result.satellite_images.summer,
        reliableAge: f.reliable_age,
        yearsTo80: f.years_to_80pct,
        year80: f.year_80pct,
        endYear: f.series.years.at(-1)!,
      },
    };
  if (f.method !== 'saturating_exp')
    return {
      status: 'unsupported',
      reason: `The forecast method “${f.method}” has no documented curve in the frontend, so it is not drawn.`,
    };
  if (f.tau == null || !Number.isFinite(f.tau) || f.tau <= 0)
    return { status: 'unsupported', reason: 'The forecast does not supply its curve parameter τ.' };
  const implied = f.tau * Math.log(1 / (1 - TARGET));
  if (f.years_to_80pct != null && Math.abs(implied - f.years_to_80pct) > YEARS_TOLERANCE)
    return {
      status: 'unsupported',
      reason: `The supplied years to 80% (${f.years_to_80pct}) do not match the curve parameter τ = ${f.tau}, so the curve is not drawn.`,
    };
  const fireYear = result.fire.year;
  const yearsTo80 = f.years_to_80pct ?? implied;
  if (f.year_80pct != null && Math.abs(fireYear + yearsTo80 - f.year_80pct) > MILESTONE_TOLERANCE)
    return {
      status: 'unsupported',
      reason: `The supplied 80% year (${f.year_80pct}) does not match the fire year plus the years to 80%, so the curve is not drawn.`,
    };
  const summer = result.satellite_images.summer;
  if (summer < fireYear)
    return { status: 'unsupported', reason: 'The observation summer precedes the fire year.' };
  const endYear = Math.max(
    summer + 30,
    f.year_80pct ?? Math.ceil(fireYear + yearsTo80),
    Math.ceil(fireYear + f.reliable_age[1]),
  );
  return {
    status: 'valid',
    curve: {
      method: 'saturating_exp',
      tau: f.tau,
      fireYear,
      summer,
      reliableAge: f.reliable_age,
      yearsTo80,
      year80: f.year_80pct,
      endYear,
    },
  };
}

/** Expected whole-fire recovery (share of neighbouring forest height) in a calendar year. */
export function curveValue(curve: GrowthCurve, year: number): number | null {
  if (curve.series) {
    const index = curve.series.years.indexOf(year);
    return index < 0 ? null : (curve.series.recovery[index] ?? null);
  }
  return recoveryAtAge(year - curve.fireYear, curve.tau ?? Number.NaN);
}

/** The same age-based equation for fire forecasts and the normalized research illustration. */
export function recoveryAtAge(age: number, tau: number): number | null {
  if (!Number.isFinite(age) || age < 0 || !Number.isFinite(tau) || tau <= 0) return null;
  return 1 - Math.exp(-age / tau);
}

export function withinReliableAge(curve: GrowthCurve, year: number): boolean | null {
  if (!curve.reliableAge) return null;
  const age = year - curve.fireYear;
  return age >= curve.reliableAge[0] && age <= curve.reliableAge[1];
}

/** Clamp a slider year to the forecast range (the observation summer to the horizon). */
export function clampYear(curve: GrowthCurve, year: number): number {
  const start = Math.min(
    curve.endYear,
    Math.max(curve.summer, curve.series?.years[0] ?? curve.summer),
  );
  return Math.min(curve.endYear, Math.max(start, Math.round(year)));
}

export interface YearEstimate {
  year: number;
  age: number;
  value: number | null;
  reliable: boolean | null;
  /** Whether the curve has reached 80% by this year. */
  reached80: boolean | null;
}

export function estimateFor(curve: GrowthCurve, year: number): YearEstimate {
  const y = clampYear(curve, year);
  const value = curveValue(curve, y);
  return {
    year: y,
    age: y - curve.fireYear,
    value,
    reliable: withinReliableAge(curve, y),
    // A supplied milestone year is the source's own answer; the fractional
    // years-to-80% (e.g. 63.1) would otherwise deny it in that very year.
    reached80:
      curve.year80 != null
        ? y >= curve.year80
        : curve.yearsTo80 == null
          ? null
          : y - curve.fireYear >= curve.yearsTo80,
  };
}

/** One point per year from the fire year to the horizon. */
export function curvePoints(curve: GrowthCurve): { year: number; value: number }[] {
  if (curve.series)
    return curve.series.years.flatMap((year, index) =>
      curve.series!.recovery[index] == null
        ? []
        : [{ year, value: curve.series!.recovery[index]! }],
    );
  const points = [];
  for (let year = curve.fireYear; year <= curve.endYear; year++)
    points.push({ year, value: curveValue(curve, year)! });
  return points;
}
