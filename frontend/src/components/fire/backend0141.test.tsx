import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FireIndexSchema, FireResultSchema, parseFireCells } from '@/data/fireSchema';
import { StudyDataApi } from '@/services/data/StudyDataApi';
import { readForecast, curveValue } from '@/domain/fire/growthForecast';
import { warningText } from '@/data/fireWarnings';
import { FireResults } from './FireResults';
import { FireResultDetails } from './FireResultDetails';
import { BundleIndexSchema, loadBundleV2 } from '@/data/bundleV2';

// Test-only values. Field shape follows origin/main b58a3de: pipeline/run.py,
// model.py and export.py; calibration values come from models/forestrecovery/accuracy.json.
const result = {
  schema_version: 1,
  fire: {
    id: 'backend_contract_test',
    name: { en: 'Backend contract test only' },
    year: 2003,
    area_ha: 3100,
    perimeter: {
      type: 'Polygon',
      coordinates: [
        [
          [-120.3, 51.2],
          [-120.1, 51.2],
          [-120.1, 51.1],
          [-120.3, 51.1],
          [-120.3, 51.2],
        ],
      ],
    },
  },
  satellite_images: {
    summer: 2026,
    nisar: { date: null, fire_covered: 0 },
    sentinel1: { from: '2026-07-10', to: '2026-07-24', scenes: 3 },
    sentinel2: { from: '2026-07-01', to: '2026-08-14', scenes: 10 },
  },
  map_grid: {
    columns: 2,
    rows: 1,
    cell_size_m: 90,
    corners_lonlat: [
      [-120.3, 51.2],
      [-120.1, 51.2],
      [-120.1, 51.1],
      [-120.3, 51.1],
    ],
  },
  neighbour_forest: { height_m: 19.1, source: 'gedi' },
  model_result: {
    model_version: 'forestrecovery 0.14.1',
    region: 'continental',
    recovery_today_avg: 0.5,
    excluded_share: 0.25,
    stage_share: [0.4, 0.3, 0.3],
    accuracy: {
      error_vs_lidar_pct: 11.7,
      mae_m: 1.78,
      null_model_mae_m: 2.18,
      n_fires: 54,
      min_gedi_points: 10,
    },
  },
  // Deliberately inconsistent legacy tau: a supplied series must be used without reconstruction.
  growth_forecast: {
    method: 'saturating_exp',
    tau: 1,
    years_to_80pct: 63.1,
    year_80pct: 2066,
    reliable_age: [8, 36],
    interval_80_now: [0.25, 0.65],
    series: {
      years: [2026, 2027, 2028, 2029],
      recovery: [0.4, 0.55, null, 0.7],
      low: [0.25, 0.35, null, 0.5],
      high: [0.65, 0.75, 0.85, 0.9],
    },
  },
  comparison: { optics: 0.95, model: 0.5, lidar: null, lidar_points_in_fire: 0 },
  lidar_points: [],
  warnings: [
    'MANY_CELLS_EXCLUDED',
    'MISSING_COVARIATES_USING_AVERAGES',
    'MODEL_INPUT_CHECK_FAILED',
  ],
  files: { cells: 'cells.json', optical_image: null },
};
const index = [
  {
    id: result.fire.id,
    name: result.fire.name,
    year: 2003,
    area_ha: 3100,
    summer: 2026,
    center_lonlat: [-120.2, 51.15],
    recovery_today_avg: 0.5,
    year_80pct: 2066,
    result: `${result.fire.id}/result.json`,
  },
];
const cells = {
  model: { stage: [0, null], p_forest_gt5: [25, null] },
  map: { zone: [1, 0] },
  optics: { ndvi: [55, null] },
};
const data = () => {
  const parsed = FireResultSchema.parse(result);
  return { result: parsed, cells: parseFireCells(cells, parsed.map_grid), opticalImageUrl: null };
};

describe('backend b58a3de / forestrecovery 0.14.1 alignment', () => {
  it('accepts English-only names, missing area summaries and a null NISAR date', () => {
    expect(FireIndexSchema.parse(index)[0]!.name.uk).toBe('');
    expect(FireIndexSchema.parse(index)[0]!.area_recovered_80pct).toBeNull();
    const parsed = data().result;
    expect(parsed.satellite_images.nisar).toEqual({ date: null, fire_covered: 0 });
    expect(parsed.satellite_images.sentinel2!.scenes).toBe(10);
    expect(parsed.model_result.accuracy).toEqual(result.model_result.accuracy);
    expect(parsed.model_result.excluded_share).toBe(0.25);
    expect(parsed.model_result.error_vs_lidar_pct).toBeNull();
  });
  it('loads actual pipeline field shapes through the shared static-export service', async () => {
    const files: Record<string, unknown> = {
      'index.json': index,
      [`${result.fire.id}/result.json`]: result,
      [`${result.fire.id}/cells.json`]: cells,
    };
    const requests: string[] = [];
    const api = new StudyDataApi({
      baseUrl: '/exports',
      fetch: (async (input) => {
        const path = String(input).replace('/exports/demo/', '');
        requests.push(path);
        return new Response(JSON.stringify(files[path]));
      }) as typeof fetch,
    });
    const loaded = (await api.loadFire(result.fire.id))!;
    expect(requests).toHaveLength(3);
    expect(loaded.cells.model.stage).toEqual([0, null]);
    expect(loaded.cells.model.recovery).toEqual([null, null]);
    expect(loaded.cells.model).not.toHaveProperty('height_m');
    expect(loaded.result.growth_forecast!.series).toEqual(result.growth_forecast.series);
  });
  it('plots supplied pipeline values and uncertainty independently of current forest state and tau', () => {
    const loaded = data();
    const forecast = readForecast(loaded.result);
    if (forecast.status !== 'valid') throw new Error('Supplied series must remain valid');
    expect(forecast.curve.seriesSource).toBe('growth_forecast.series');
    expect(curveValue(forecast.curve, 2026)).toBe(0.4);
    expect(curveValue(forecast.curve, 2028)).toBeNull();
    expect(forecast.curve.reliableAge).toEqual([8, 36]);
    const html = renderToStaticMarkup(
      <FireResults data={loaded} forecast={forecast} year={2026} />,
    );
    for (const label of [
      'interval_80_now',
      '25% – 65%',
      '2066',
      '63.1',
      'data-forecast-source="growth_forecast.series"',
      'data-forecast-interval="80"',
      'model_result.recovery_today_avg',
    ])
      expect(html).toContain(label);
    expect(html).not.toContain('model2.now_recovery');
  });
  it('shows excluded area and regional validation statistics with appropriate limitations', () => {
    const loaded = data();
    const html = renderToStaticMarkup(
      <FireResults data={loaded} forecast={readForecast(loaded.result)} year={2026} />,
    );
    for (const label of [
      '25%',
      '11.7%',
      '1.78',
      '2.18',
      '54',
      '10',
      'not a confidence interval',
      'per-cell error guarantee',
    ])
      expect(html).toContain(label);
    expect(html).not.toContain('±11.7');
    const details = renderToStaticMarkup(
      <FireResultDetails data={loaded} forecast={readForecast(loaded.result)} />,
    );
    expect(details).toContain('Acquisition date not supplied');
    expect(details).toContain('0% of the fire covered');
    expect(details).toContain('10 scenes');
    expect(details).not.toContain('>null');
  });
  it('leaves unavailable accuracy and out-of-region forecasts unavailable', () => {
    const parsed = FireResultSchema.parse({
      ...result,
      model_result: { ...result.model_result, accuracy: null, recovery_today_avg: null },
      growth_forecast: null,
      warnings: ['REGION_EXTRAPOLATED', 'ACCURACY_NOT_VALIDATED_WITHOUT_GEDI'],
    });
    const html = renderToStaticMarkup(
      <FireResults
        data={{ ...data(), result: parsed }}
        forecast={readForecast(parsed)}
        year={2026}
      />,
    );
    expect(html).toContain('No regional accuracy statistics were supplied');
    expect(html).toContain('No fire-level forecast was supplied');
    expect(html).not.toContain('data-forecast-interval');
  });
  it('validates added scientific fields and preserves nulls and zero values', () => {
    expect(
      FireResultSchema.safeParse({
        ...result,
        model_result: { ...result.model_result, excluded_share: 1.1 },
      }).success,
    ).toBe(false);
    expect(
      FireResultSchema.safeParse({
        ...result,
        model_result: {
          ...result.model_result,
          accuracy: { ...result.model_result.accuracy, n_fires: -1 },
        },
      }).success,
    ).toBe(false);
    expect(
      FireResultSchema.safeParse({
        ...result,
        growth_forecast: { ...result.growth_forecast, interval_80_now: [0.8, 0.2] },
      }).success,
    ).toBe(false);
    expect(
      FireResultSchema.safeParse({
        ...result,
        growth_forecast: {
          ...result.growth_forecast,
          series: { ...result.growth_forecast.series, low: [] },
        },
      }).success,
    ).toBe(false);
    const zero = FireResultSchema.parse({
      ...result,
      model_result: { ...result.model_result, excluded_share: 0 },
    });
    expect(zero.model_result.excluded_share).toBe(0);
  });
  it('explains current pipeline/library warnings and retains unknown code fallback', () => {
    for (const code of [
      'REGION_EXTRAPOLATED',
      'MODEL_INPUT_CHECK_FAILED',
      'MANY_CELLS_EXCLUDED',
      'ACCURACY_NOT_VALIDATED_WITHOUT_GEDI',
      'MISSING_COVARIATES_USING_AVERAGES',
      'COVARIATE_OUT_OF_TRAINING_RANGE',
      'AGE_BELOW_VALIDATED',
      'NOT_VALIDATED_REGION',
    ])
      expect(warningText(code)).not.toContain('meaning needs confirmation');
    expect(warningText('FUTURE_BACKEND_CODE')).toContain('meaning needs confirmation');
  });
  it('reports each bundle manifest version without relabeling the original 0.14.0 scientific assets', async () => {
    const root = resolve(import.meta.dirname, '../../../public/data/bundle-v2');
    const original = BundleIndexSchema.parse(
      JSON.parse(readFileSync(resolve(root, 'index.json'), 'utf8')),
    );
    const entry = original.fires.find((fire) => fire.id === 'bc_2003_490')!;
    const read = async (url: string): Promise<unknown> => {
      const value = JSON.parse(readFileSync(resolve(root, url.slice(1)), 'utf8'));
      return url.endsWith('/manifest.json') ? { ...value, library_version: '0.14.1' } : value;
    };
    const bundle = await loadBundleV2('', entry, original.summer, read);
    expect(bundle.result.model_result.model_version).toBe('forestrecovery 0.14.1');
    expect(original.library_version).toBe('0.14.0');
  });
});
