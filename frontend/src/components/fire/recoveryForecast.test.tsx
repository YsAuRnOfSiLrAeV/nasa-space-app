import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BundleIndexSchema, loadBundleV2, SeriesSchema } from '@/data/bundleV2';
import { readForecast, curveValue, estimateFor } from '@/domain/fire/growthForecast';
import { formatForecastPercent } from '@/domain/fire/forecastFormatting';
import { FireResults } from './FireResults';
import { ForecastChart } from './ForecastChart';
import { SuppliedForecastSummary } from './SuppliedForecastSummary';

const root = resolve(import.meta.dirname, '../../../public/data/bundle-v2');
const read = async (path: string): Promise<unknown> =>
  JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const index = BundleIndexSchema.parse(await read('index.json'));
const load = (id: string) =>
  loadBundleV2(
    '',
    index.fires.find((entry) => entry.id === id)!,
    index.summer,
    (url) => read(url.slice(1)),
  );

describe('supplied whole-fire recovery forecast', () => {
  it.each(index.fires)(
    'uses $id supplied forecast, summary and uncertainty directly',
    async (entry) => {
      const data = await load(entry.id);
      const model = data.bundle!.source.model2;
      const forecast = readForecast(data.result, model);
      const html = renderToStaticMarkup(
        <FireResults data={data} forecast={forecast} year={index.summer} />,
      );
      if (model.forecast === 'growth') {
        expect(html).toContain(entry.id);
        expect(html).toContain('model2.now_recovery');
        expect(html).toContain(formatForecastPercent(model.now_recovery));
        if (forecast.status !== 'valid') throw new Error(`Missing supplied forecast: ${entry.id}`);
        expect(forecast.curve.series).toBe(model.series);
        expect(forecast.curve.reliableAge).toBeNull();
        model.series!.years.forEach((year, i) =>
          expect(curveValue(forecast.curve, year)).toBe(model.series!.recovery[i]),
        );
        expect(html).toContain(String(model.year_80pct));
        expect(html).toContain('data-forecast-interval="80"');
        expect(html).toContain('Selected-year 80% uncertainty bounds');
        for (const bound of model.interval_80 ?? [])
          expect(html).toContain(formatForecastPercent(bound));
        for (const code of model.warnings ?? []) expect(html).toContain(code);
        if (data.bundle!.source.reliability.model2)
          expect(html).toContain(data.bundle!.source.reliability.model2);
      } else {
        expect(forecast.status).toBe('none');
        // Outside Canada the model-2 block is not shown at all (no list of "Not available").
        expect(html).not.toContain('model2.now_recovery');
        expect(html).not.toContain('No supported recovery forecast');
        expect(html).not.toContain('data-forecast-interval');
      }
    },
  );

  it('shows BC current estimate, summary interval and milestone with source precision', async () => {
    const data = await load('bc_2003_490');
    const html = renderToStaticMarkup(<SuppliedForecastSummary data={data} />);
    for (const label of [
      '44.36%',
      '27.12%',
      '61.61%',
      '2066',
      '63.1',
      'Likely range',
      'Year it reaches 80%',
      'FORECAST_EXTRAPOLATES_BEYOND_AGE_36',
      'spatial cell timeline is separate',
    ])
      expect(html).toContain(label);
  });

  it('does not replace missing summary fields with series estimates or hide a series when optional milestones are absent', async () => {
    const data = await load('bc_2003_490');
    const model = data.bundle!.source.model2;
    model.now_recovery = null;
    model.interval_80 = null;
    model.year_80pct = null;
    model.years_to_80pct = null;
    const forecast = readForecast(data.result, model);
    expect(forecast.status).toBe('valid');
    const html = renderToStaticMarkup(<SuppliedForecastSummary data={data} />);
    expect(html).toContain('data-value="missing"');
    expect(html).toContain('Not supplied');
    expect(html).not.toContain('2066');
    if (forecast.status !== 'valid') throw new Error('Series must remain available');
    expect(estimateFor(forecast.curve, 2026).value).toBe(0.4436);
    expect(estimateFor(forecast.curve, 2026).reached80).toBeNull();
  });

  it('keeps a differing summary interval independent of per-year bounds and preserves unknown warnings', async () => {
    const data = await load('bc_2003_490');
    const model = data.bundle!.source.model2;
    model.now_recovery = 0;
    model.interval_80 = [0.1, 0.9];
    model.warnings = ['TEAM_NEW_WARNING'];
    const forecast = readForecast(data.result, model);
    const html = renderToStaticMarkup(<FireResults data={data} forecast={forecast} year={2026} />);
    for (const label of ['0%', '10% – 90%', 'Lower: 27.12%', 'Upper: 61.61%', 'TEAM_NEW_WARNING'])
      expect(html).toContain(label);
  });

  it('shows partial uncertainty with gaps, even when a recovery value is missing', async () => {
    const data = await load('bc_2003_490');
    const model = data.bundle!.source.model2;
    model.series = {
      years: [2026, 2027, 2028, 2029],
      recovery: [1.2, null, 0.7, 0.8],
      low: [null, 0.2, 0.4, null],
      high: [1.5, 0.8, null, null],
    };
    const forecast = readForecast(data.result, model);
    if (forecast.status !== 'valid') throw new Error('Valid partial series expected');
    expect(estimateFor(forecast.curve, 2027).value).toBeNull();
    const html = renderToStaticMarkup(
      <ForecastChart curve={forecast.curve} observed={null} year={2027} />,
    );
    expect(html).toContain('Some uncertainty bounds are not supplied');
    expect(html).toContain('data-forecast-bound="low"');
    expect(html).toContain('data-forecast-bound="high"');
    expect(html).not.toContain('NaN');
    expect(html).not.toContain('validated ages');
  });

  it('reports completely absent uncertainty and rejects reversed bounds without a central estimate', async () => {
    const data = await load('bc_2003_490');
    const model = data.bundle!.source.model2;
    model.series!.low.fill(null);
    model.series!.high.fill(null);
    const forecast = readForecast(data.result, model);
    const html = renderToStaticMarkup(<FireResults data={data} forecast={forecast} year={2026} />);
    expect(html).not.toContain('data-forecast-interval="80"');
    expect(html).toContain('Lower: Not available');
    expect(html).toContain('Upper: Not available');
    expect(
      SeriesSchema.safeParse({ years: [2026], recovery: [null], low: [0.9], high: [0.2] }).success,
    ).toBe(false);
  });
});
