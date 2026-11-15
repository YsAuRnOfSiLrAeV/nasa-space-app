import {
  DEMO_FIRE_COMPARISON,
  FORECAST_VALIDATION,
  HEIGHT_ACCURACY,
  INPUT_FEATURES,
  SCORE_BANDS,
  SCORE_CALIBRATION,
  VALIDATION_DESIGN,
} from '@/data/calibrationEvidence';
import { GRID_LAYERS, PROBABILITY_BREAKS } from '@/domain/fire/fireGrid';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CHAPTER_LIST } from './chapters';
import { verdict } from './figures/scoreVerdict';
import { Supporting } from './ChapterFrame';
import { ResearchPage } from './ResearchPage';

const text = (markup: string) =>
  markup
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');
const page = (load: Parameters<typeof ResearchPage>[0]['load']) =>
  renderToStaticMarkup(<ResearchPage load={load} study={null} />);
const UNAVAILABLE = page({ status: 'error', message: 'HTTP 500', retry: () => {} });

describe('calibration evidence matches the reports', () => {
  it('has the four demonstration fires with the reported values', () => {
    expect(DEMO_FIRE_COMPARISON.map((r) => [r.fire, r.optical, r.modelCalibrated, r.gedi])).toEqual(
      [
        ['Quebec 2010', 93, 81, 43],
        ['BC 2003', 90, 49, 37],
        ['Ontario 1988', 83, 66, 67],
        ['Quebec 1995', 94, 80, 88],
      ],
    );
    expect(DEMO_FIRE_COMPARISON.map((r) => r.neighbourM)).toEqual([8.8, 19.1, 13.6, 11.0]);
  });

  it('has seven inputs, of which only three are NISAR', () => {
    expect(INPUT_FEATURES).toHaveLength(7);
    const bySensor = (s: string) => INPUT_FEATURES.filter((f) => f.sensor === s).map((f) => f.name);
    expect(bySensor('Sentinel-1')).toEqual(['VV', 'VH', 'VH − VV']);
    expect(bySensor('Optical')).toEqual(['NDVI']);
    expect(bySensor('NISAR')).toEqual(['HV', 'HH', 'HV − HH']);
  });

  it('has the reported validation design and accuracy', () => {
    expect(VALIDATION_DESIGN).toMatchObject({ points: 1485, fires: 131, country: 'Canada' });
    expect(HEIGHT_ACCURACY.point).toMatchObject({ maeM: 3.7, r2: 0.11 });
    expect(HEIGHT_ACCURACY.fire).toMatchObject({
      maeM: 1.8,
      r2: 0.34,
      baselineMaeM: 2.2,
      fires: 54,
      relativeErrorMedianPct: 11.7,
      relativeErrorMeanPct: 13.7,
    });
    expect(FORECAST_VALIDATION).toMatchObject({
      fires: 51,
      r2WithDrivers: 0.44,
      r2Comparison: 0.38,
      nominalIntervalPct: 80,
      observedCoveragePct: 82,
      extrapolationBeyondYears: 36,
    });
  });

  it('has the reported cross-country AUCs and calibration verdicts', () => {
    const auc = Object.fromEntries(SCORE_CALIBRATION.map((r) => [r.country, r.auc]));
    expect(auc).toMatchObject({
      Canada: 0.71,
      Ukraine: 0.69,
      Turkey: 0.65,
      Zambia: 0.9,
      Tanzania: 0.82,
    });
    const by = Object.fromEntries(SCORE_CALIBRATION.map((r) => [r.country, verdict(r)]));
    expect(by.Zambia).toBe('Worse than the base rate');
    expect(by.Tanzania).toBe('Worse than the base rate');
    expect(by.Turkey).toBe('No better than the base rate');
    expect(by.Canada).toBe('Better than the base rate');
  });
});

describe('relative score presentation', () => {
  it('uses one centralized, provisional set of bands for the map layer', () => {
    expect(PROBABILITY_BREAKS).toBe(SCORE_BANDS.breaks);
    expect(GRID_LAYERS.probability.categories).toEqual(['Low', 'Medium', 'High']);
    expect(SCORE_BANDS.status).toMatch(/provisional/i);
  });
});

describe('research page', () => {
  it('renders all five chapters without the Ontario study data', () => {
    const out = text(UNAVAILABLE);
    expect(CHAPTER_LIST).toHaveLength(5);
    for (const chapter of CHAPTER_LIST) {
      expect(out).toContain(chapter.title);
      expect(out).toContain(chapter.question);
      expect(out).toContain(chapter.figure.title);
    }
    // Five chapter figures and the headline comparison in the opening band.
    expect((UNAVAILABLE.match(/<figure/g) ?? []).length).toBe(6);
    expect(out).toContain('The Ontario study sample could not be loaded.');
    expect(out).toContain('Study data unavailable');
  });

  it('shows a loading note for the supporting sample only', () => {
    const out = text(page({ status: 'loading' }));
    expect(out).toContain('Loading the Ontario study sample');
    expect(out).toContain('Green does not always mean recovered');
  });

  it('labels figures as calibration-study results with their source and units', () => {
    const out = text(UNAVAILABLE);
    expect(out).toContain('Calibration study');
    expect(out).toContain('Source: project height calibration study against GEDI');
    expect(out).toContain('Source: project calibration review');
    // Internal report files are never named on the page.
    expect(UNAVAILABLE).not.toMatch(/\.pdf|CALIBRATION_/);
    expect(out).toContain('not necessarily the values shown by the example-fire exports');
    expect(out).toContain('% of neighbouring forest height');
    expect(out).toContain('3.7 m');
    expect(out).toContain('mean absolute error (MAE), metres');
    expect(out).toContain('Ranking skill (AUC)');
    expect(out).toContain('1.8 m');
    expect(out).toContain('baseline 2.2 m');
    expect(out).toContain('metres · prediction minus GEDI');
    expect(out).toContain('nominal 80%');
    expect(out).toContain('Real share of GEDI points above 5 m');
  });

  it('marks provisional and unresolved assumptions', () => {
    const out = text(UNAVAILABLE);
    expect(out).toContain(
      'The optical-to-recovery rule (NDVI 0.2…0.8 mapped to 0…100%) is provisional',
    );
    expect(out).toContain('Provisional · not confirmed by the model owner');
    expect(out).toContain('R(age) = 1 − exp(−age / τ)');
    expect(out).toContain('Provisional thresholds, pending approval by the model owner');
    expect(out).toContain('no zone geometry has been supplied');
  });

  it('does not overclaim', () => {
    const out = text(UNAVAILABLE);
    expect(out).toContain('Optical readings do not always overestimate recovery');
    expect(out).toContain('The model also substantially overestimates Quebec 2010');
    expect(out).toContain('Only three of the seven are NISAR measurements');
    expect(out).toContain('it does not measure tree height');
    expect(out).toContain('Good ranking does not guarantee calibrated probabilities');
    expect(out).toContain('It is not an uncertainty interval for any one fire');
    expect(out).not.toMatch(/dev fixture|development fixture/i);
    expect(out).not.toMatch(/NISAR (alone )?outperforms/i);
  });
});

describe('deferred supporting figures', () => {
  it('does not mount a deferred figure before its disclosure opens', () => {
    let mounted = false;
    function Figure() {
      mounted = true;
      return <div>Chart content</div>;
    }
    const html = renderToStaticMarkup(
      <Supporting defer summary="Chart">
        <Figure />
      </Supporting>,
    );
    expect(mounted).toBe(false);
    expect(html).toContain('Chart');
    expect(html).not.toContain('Chart content');
  });
  it('keeps ordinary supporting text available', () => {
    const html = renderToStaticMarkup(
      <Supporting summary="Method">
        <p>Method content</p>
      </Supporting>,
    );
    expect(html).toContain('Method content');
  });
});
