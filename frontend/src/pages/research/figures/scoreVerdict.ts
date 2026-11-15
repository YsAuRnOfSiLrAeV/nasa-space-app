import type { CountryCalibration } from '@/data/calibrationEvidence';

/** Brier against the null model, in words. Derived from the two reported numbers only. */
export function verdict(r: Pick<CountryCalibration, 'brier' | 'brierNull'>): string {
  if (r.brier > r.brierNull) return 'Worse than the base rate';
  if (r.brier === r.brierNull) return 'No better than the base rate';
  return 'Better than the base rate';
}
