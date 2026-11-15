/** Source ratios are exported to four decimal places; percentage labels preserve that precision. */
export function formatForecastPercent(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value)
    ? 'Not available'
    : `${Number((value * 100).toFixed(2))}%`;
}
