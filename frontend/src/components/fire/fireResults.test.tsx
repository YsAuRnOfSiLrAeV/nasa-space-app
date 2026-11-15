import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  FireCellsSchema,
  FireResultSchema,
  type FireData,
  type FireResult,
} from '@/data/fireSchema';
import { FireResults } from './FireResults';
import { FireResultDetails } from './FireResultDetails';
import { ForecastYearBar } from './ForecastYearBar';
import {
  comparisonRows,
  formatError,
  formatShare,
  isProvided,
  missingResults,
  neighbourForest,
  stageSegments,
  UNAVAILABLE,
} from '../../domain/fire/fireSummary';
import {
  clampYear,
  curvePoints,
  curveValue,
  estimateFor,
  readForecast,
  withinReliableAge,
  type GrowthCurve,
} from '../../domain/fire/growthForecast';

const DEMO = join(__dirname, '../../../public/data/demo');
const load = (id: string): FireData => ({
  result: FireResultSchema.parse(JSON.parse(readFileSync(join(DEMO, id, 'result.json'), 'utf8'))),
  cells: FireCellsSchema.parse(JSON.parse(readFileSync(join(DEMO, id, 'cells.json'), 'utf8'))),
  opticalImageUrl: null,
});
const BC = load('bc_2003_490');
const FIXTURES = ['quebec_1995_fixture', 'quebec_2010_fixture', 'ontario_1988_fixture'].map(load);

const withModel = (patch: Partial<FireResult['model_result']>): FireData => ({
  ...BC,
  result: { ...BC.result, model_result: { ...BC.result.model_result, ...patch } },
});
const withForecast = (patch: Partial<NonNullable<FireResult['growth_forecast']>> | null) => ({
  ...BC.result,
  growth_forecast: patch === null ? null : { ...BC.result.growth_forecast!, ...patch },
});
const html = (data: FireData) => {
  const forecast = readForecast(data.result);
  return renderToStaticMarkup(
    <>
      <FireResults data={data} forecast={forecast} year={data.result.satellite_images.summer} />
      <FireResultDetails data={data} forecast={forecast} />
    </>,
  );
};
const valueOf = (markup: string, label: string) => {
  const at = markup.indexOf(`<dt>${label}</dt>`);
  expect(at, label).toBeGreaterThan(-1);
  return /<dd data-value="([^"]*)">([^<]*)<\/dd>/.exec(markup.slice(at))!.slice(1);
};

describe('missing versus zero', () => {
  it('treats only null and undefined as missing', () => {
    expect(isProvided(0)).toBe(true);
    expect(isProvided(null)).toBe(false);
    expect(isProvided(undefined)).toBe(false);
    expect(formatShare(0)).toBe('0%');
    expect(formatShare(null)).toBe(UNAVAILABLE);
    expect(formatShare(undefined)).toBe(UNAVAILABLE);
    expect(formatShare(0.004)).toBe('<1%');
    expect(formatShare(0.36)).toBe('36%');
    expect(formatError(0)).toBe('±0%');
    expect(formatError(null)).toBe(UNAVAILABLE);
    expect(formatError(10)).toBe('±10%');
  });

  it('renders the BC area recovered to 80% (0.0 in the export) as 0%, not unavailable', () => {
    expect(BC.result.model_result.area_recovered_80pct).toBe(0);
    expect(valueOf(html(BC), 'Area recovered to 80%')).toEqual(['0', '0%']);
  });

  it('renders null recovery statistics as unavailable, never 0%', () => {
    const markup = html(
      withModel({ recovery_today_avg: null, area_recovered_80pct: null, error_vs_lidar_pct: null }),
    );
    expect(valueOf(markup, 'Whole-fire recovery today')).toEqual(['missing', UNAVAILABLE]);
    expect(valueOf(markup, 'Area recovered to 80%')).toEqual(['missing', UNAVAILABLE]);
    expect(markup).toContain(`<span data-value="missing">${UNAVAILABLE}</span>`);
    expect(markup).toContain('Not supplied in this export: whole-fire recovery');
  });

  it('renders zero recovery and zero error as values', () => {
    const markup = html(withModel({ recovery_today_avg: 0, error_vs_lidar_pct: 0 }));
    expect(valueOf(markup, 'Whole-fire recovery today')).toEqual(['0', '0%']);
    expect(markup).toContain('<span data-value="0">±0%</span>');
    expect(missingResults(withModel({ recovery_today_avg: 0 }).result)).not.toContain(
      'whole-fire recovery',
    );
  });

  it('keeps a zero stage share as a 0% stage, and null shares as unavailable', () => {
    const segments = stageSegments([0, 0.4, 0.6])!;
    expect(segments.map((s) => s.share)).toEqual([0, 0.4, 0.6]);
    const markup = html(withModel({ stage_share: [0, 0.4, 0.6] }));
    expect(markup).toContain('Below 5 m<span');
    expect(markup).toMatch(/Below 5 m<span[^>]*>0%<\/span>/);
    expect(stageSegments(null)).toBeNull();
    expect(html(withModel({ stage_share: null }))).toContain(
      `${UNAVAILABLE}: the export does not supply stage shares.`,
    );
  });

  it('keeps a zero comparison value as comparable data', () => {
    const { rows, comparable } = comparisonRows({
      optics: 0,
      model: 0,
      lidar: null,
      lidar_points_in_fire: 0,
    });
    expect(rows.map((r) => r.value)).toEqual([0, 0]);
    expect(comparable).toBe(true);
    expect(
      comparisonRows({ optics: 0.9, model: null, lidar: null, lidar_points_in_fire: 0 }).comparable,
    ).toBe(false);
    expect(comparisonRows(null).rows).toEqual([]);
  });
});

describe('whole-fire summary', () => {
  it('names the neighbouring forest source it actually came from', () => {
    expect(neighbourForest({ height_m: 19.1, source: 'gedi' })).toEqual({
      height: '19.1 m',
      source: 'GEDI lidar around the fire',
    });
    expect(neighbourForest({ height_m: 15, source: 'eth' }).source).toMatch(/ETH.*approximate/);
    expect(neighbourForest({ height_m: null, source: 'gedi' }).height).toBe(UNAVAILABLE);
    expect(neighbourForest(null)).toEqual({ height: UNAVAILABLE, source: UNAVAILABLE });
  });

  it('shows BC values exactly as supplied, with the validated error from the export', () => {
    const markup = html(BC);
    expect(valueOf(markup, 'Whole-fire recovery today')).toEqual(['0.36', '36%']);
    expect(markup).toContain('<span data-value="10">±10%</span>');
    expect(markup).not.toContain('±12');
    expect(markup).toContain('Optical greenness');
    expect(markup).toContain('GEDI lidar points inside the fire: 25.');
  });

  it('labels observation and prediction separately', () => {
    const markup = html(BC);
    expect(markup).toContain('Current modeled state · not a measurement or forecast');
    expect(markup).toContain('Prediction · whole fire');
    expect(markup).toContain('does not recolour the grid');
  });

  it('renders development fixtures as unavailable without a forecast block', () => {
    for (const data of FIXTURES) {
      const markup = html(data);
      expect(readForecast(data.result).status).toBe('none');
      expect(markup).not.toContain('Recovery forecast');
      expect(valueOf(markup, 'Whole-fire recovery today')).toEqual(['missing', UNAVAILABLE]);
      expect(markup).toContain('No comparison values are supplied');
      expect(markup).toContain('Development fixture generated by');
      expect(markup).not.toMatch(/>\d+%</);
    }
  });
});

describe('growth forecast', () => {
  const curve = (readForecast(BC.result) as { curve: GrowthCurve }).curve;

  it('accepts the BC forecast because the curve reproduces its supplied milestones', () => {
    expect(readForecast(BC.result).status).toBe('valid');
    expect(curve.yearsTo80).toBe(40.6);
    expect(curveValue(curve, 2003 + 40.6)).toBeCloseTo(0.8, 3);
    expect(curveValue(curve, curve.year80!)).toBeGreaterThanOrEqual(0.79);
    expect(curveValue(curve, 2002)).toBeNull();
    expect(curveValue(curve, 2003)).toBe(0);
  });

  it('hides the forecast when absent, unsupported or inconsistent', () => {
    expect(readForecast(withForecast(null)).status).toBe('none');
    expect(readForecast(withForecast({ method: 'logistic' })).status).toBe('unsupported');
    expect(readForecast(withForecast({ tau: null })).status).toBe('unsupported');
    expect(readForecast(withForecast({ years_to_80pct: 20 })).status).toBe('unsupported');
    expect(readForecast(withForecast({ year_80pct: 2060 })).status).toBe('unsupported');
  });

  it('runs from the observation summer, never backwards, and flags extrapolation', () => {
    expect(clampYear(curve, 2010)).toBe(2026);
    expect(clampYear(curve, 3000)).toBe(curve.endYear);
    expect(curve.endYear).toBeGreaterThanOrEqual(curve.year80!);
    expect(withinReliableAge(curve, 2026)).toBe(true); // age 23 in 9–35
    expect(withinReliableAge(curve, 2040)).toBe(false); // age 37
    const e = estimateFor(curve, 2044);
    expect(e).toMatchObject({ year: 2044, age: 41, reliable: false, reached80: true });
    expect(estimateFor(curve, 2030).reached80).toBe(false);
  });

  it('counts a supplied 80% year as reached in that year, whatever the fractional age says', () => {
    // BC 2003 bundle: year_80pct 2066 with years_to_80pct 63.1 (2003 + 63 < 63.1).
    const supplied = { ...curve, year80: 2066, yearsTo80: 63.1, endYear: 2066 };
    expect(estimateFor(supplied, 2066).reached80).toBe(true);
    expect(estimateFor(supplied, 2065).reached80).toBe(false);
  });

  it('is monotonic and has no points before the fire', () => {
    const points = curvePoints(curve);
    expect(points[0]).toEqual({ year: 2003, value: 0 });
    for (let i = 1; i < points.length; i++)
      expect(points[i]!.value).toBeGreaterThan(points[i - 1]!.value);
  });

  it('labels the slider as a whole-fire forecast that leaves the grid unchanged', () => {
    const markup = renderToStaticMarkup(
      <ForecastYearBar curve={curve} year={2040} onYear={() => {}} />,
    );
    expect(markup).toContain('type="range"');
    expect(markup).toContain('min="2026"');
    expect(markup).toContain('Map grid: summer 2026 observation, unchanged by this slider');
    expect(markup).toContain('extrapolation');
    expect(markup).toContain('Back to 2026');
  });

  it('drives the map with modeled cell recovery when the fire has a cell timeline', () => {
    const years = [2003, 2004, 2026, 2040, 2066];
    const shown = (year: number | null) =>
      renderToStaticMarkup(
        <ForecastYearBar
          curve={curve}
          year={2026}
          onYear={() => {}}
          cells={{ years, year, onYear: () => {} }}
        />,
      );
    const off = shown(null);
    expect(off).toContain('Drag to see the forest recover, year by year');
    // The slider steps through the timeline's own years, from the fire year.
    expect(off).toMatch(/type="range"[^>]*min="0"[^>]*max="4"/);
    expect(off).toContain(
      'Drag the slider: the map will colour each cell by how far it has recovered in that year (modeled).',
    );
    expect(off).not.toContain('Hide modeled cells');
    const on = shown(2004);
    expect(on).toMatch(/type="range"[^>]*value="1"/);
    expect(on).toContain('Map: each cell’s modeled recovery in 2004');
    expect(on).toContain('modeled back from summer 2026');
    expect(on).toContain('not an observation');
    expect(on).toContain('Back to 2026');
    expect(on).toContain('Hide modeled cells');
  });

  it('says the map cannot follow a fire without a cell timeline', () => {
    const series = {
      ...curve,
      series: {
        years: [2003, 2026, 2066],
        recovery: [0, 0.4, 0.8],
        low: [0, 0.3, 0.6],
        high: [0.1, 0.5, 0.9],
      },
    };
    const markup = renderToStaticMarkup(
      <ForecastYearBar curve={series} year={2026} onYear={() => {}} cells={null} />,
    );
    expect(markup).toContain('Whole-fire forecast · drag to change the year');
    expect(markup).toContain(
      'No cell map was exported for this fire: the slider only moves the whole-fire forecast (chart in the panel), not the map.',
    );
  });

  it('states that no uncertainty interval is supplied', () => {
    expect(html(BC)).toContain('The export supplies no forecast interval, so none is drawn.');
  });
});
