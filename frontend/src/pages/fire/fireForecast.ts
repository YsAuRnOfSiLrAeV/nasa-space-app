import type { FireData, FireResult } from '@/data/fireSchema';

/** Explicit frontend preview assumption, pending confirmation by the model owner.
 * r(t) = 1 - (1 - r0) exp(-deltaYears / tau). Never backcasts observations.
 * Values already above the neighbouring-forest reference are retained.
 */
export function previewRecovery(value: number | null, years: number, tau: number): number | null {
  if (value == null || years < 0 || !Number.isFinite(tau) || tau <= 0) return null;
  return value >= 1 ? value : 1 - (1 - value) * Math.exp(-years / tau);
}

export function canPreview(result: FireResult): boolean {
  return result.growth_forecast?.method === 'saturating_exp' && result.growth_forecast.tau != null;
}

export function forecastEndYear(result: FireResult): number {
  const summer = result.satellite_images.summer;
  return Math.max(
    summer + 30,
    result.growth_forecast?.year_80pct ?? summer,
    Math.ceil(result.fire.year + (result.growth_forecast?.reliable_age[1] ?? 0)),
  );
}

export function outsideReliableAge(result: FireResult, year: number): boolean {
  const range = result.growth_forecast?.reliable_age;
  const age = year - result.fire.year;
  return range != null && (age < range[0] || age > range[1]);
}

/** Only project eligible burned cells. Leave missing data, reference cells and
 * supplied state-only areas intact in the source; hide unsupported future values.
 * Stages, probabilities, NDVI and lidar are never synthesized by a growth curve.
 */
export function previewFire(data: FireData, year: number): FireData {
  const years = year - data.result.satellite_images.summer;
  if (years === 0) return data;
  const { cells, result } = data;
  const tau = canPreview(result) ? result.growth_forecast!.tau! : null;
  const recovery = cells.model.recovery.map((value, i) => {
    if (cells.map.zone[i] === 0) return value;
    if (
      years < 0 ||
      tau == null ||
      cells.map.zone[i] !== 1 ||
      cells.map.confidence[i] !== 2 ||
      (cells.map.reburn_year[i] != null &&
        cells.map.reburn_year[i]! > result.satellite_images.summer)
    )
      return null;
    const projected = previewRecovery(value == null ? null : value / 100, years, tau);
    return projected == null ? null : projected * 100;
  });
  const empty = cells.model.stage.map(() => null);
  return {
    ...data,
    cells: {
      ...cells,
      model: { recovery, stage: empty, p_forest_gt5: empty },
      optics: { ndvi: empty },
    },
  };
}
