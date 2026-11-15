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
 * and no uncertainty interval is drawn unless the export supplies one (it does not yet).
 */
import type { FireResult } from '@/data/fireSchema';

/** Tolerance for rounding in the supplied milestones. */
const YEARS_TOLERANCE = 0.5;
const MILESTONE_TOLERANCE = 1;
export const TARGET = 0.8;

export interface GrowthCurve {
  method: 'saturating_exp';
  tau: number;
  fireYear: number;
  /** The observation summer: the grid's year, and the first forecast year. */
  summer: number;
  reliableAge: [number, number];
  yearsTo80: number;
  year80: number | null;
  /** Slider and chart horizon. */
  endYear: number;
}

export type ForecastStatus =
  | { status: 'none' }
  | { status: 'unsupported'; reason: string }
  | { status: 'valid'; curve: GrowthCurve };

export function readForecast(result: FireResult): ForecastStatus {
  const f = result.growth_forecast;
  if (!f) return { status: 'none' };
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
  return recoveryAtAge(year - curve.fireYear, curve.tau);
}

/** The same age-based equation for fire forecasts and the normalized research illustration. */
export function recoveryAtAge(age: number, tau: number): number | null {
  if (!Number.isFinite(age) || age < 0 || !Number.isFinite(tau) || tau <= 0) return null;
  return 1 - Math.exp(-age / tau);
}

export function withinReliableAge(curve: GrowthCurve, year: number): boolean {
  const age = year - curve.fireYear;
  return age >= curve.reliableAge[0] && age <= curve.reliableAge[1];
}

/** Clamp a slider year to the forecast range (the observation summer to the horizon). */
export function clampYear(curve: GrowthCurve, year: number): number {
  return Math.min(curve.endYear, Math.max(curve.summer, Math.round(year)));
}

export interface YearEstimate {
  year: number;
  age: number;
  value: number;
  reliable: boolean;
  /** Whether the curve has reached 80% by this year. */
  reached80: boolean;
}

export function estimateFor(curve: GrowthCurve, year: number): YearEstimate {
  const y = clampYear(curve, year);
  const value = curveValue(curve, y)!;
  return {
    year: y,
    age: y - curve.fireYear,
    value,
    reliable: withinReliableAge(curve, y),
    reached80: y - curve.fireYear >= curve.yearsTo80,
  };
}

/** One point per year from the fire year to the horizon. */
export function curvePoints(curve: GrowthCurve): { year: number; value: number }[] {
  const points = [];
  for (let year = curve.fireYear; year <= curve.endYear; year++)
    points.push({ year, value: curveValue(curve, year)! });
  return points;
}
