import { z } from 'zod';

const Recovery = z.number().min(0).max(2);
export const ForecastIntervalSchema = z
  .tuple([Recovery, Recovery])
  .refine(([low, high]) => low <= high, 'Forecast interval bounds must be ordered');
export const ForecastSeriesSchema = z
  .object({
    years: z.array(z.number().int().positive()).min(1),
    recovery: z.array(Recovery.nullable()),
    low: z.array(Recovery.nullable()),
    high: z.array(Recovery.nullable()),
  })
  .superRefine((series, context) => {
    if (
      series.years.some((year, i) => i > 0 && year !== series.years[i - 1]! + 1) ||
      [series.recovery, series.low, series.high].some(
        (values) => values.length !== series.years.length,
      ) ||
      series.low.some((low, i) => low != null && series.high[i] != null && low > series.high[i]!) ||
      series.recovery.some(
        (value, i) =>
          value != null &&
          ((series.low[i] != null && series.low[i]! > value) ||
            (series.high[i] != null && series.high[i]! < value)),
      )
    )
      context.addIssue({ code: 'custom', message: 'Invalid supplied forecast series or bounds.' });
  });
export type ForecastSeries = z.infer<typeof ForecastSeriesSchema>;
