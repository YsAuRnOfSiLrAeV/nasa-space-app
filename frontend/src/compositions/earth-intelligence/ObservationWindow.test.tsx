/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildStudyView, type StudyView } from '@/domain/study/studyView';
import type { Manifest, PointCollection } from '@/data/schema';
import { ObservationWindow } from './ObservationWindow';

const root = resolve(import.meta.dirname, '../../..');
const json = <T,>(path: string) => JSON.parse(readFileSync(resolve(root, path), 'utf8')) as T;
const study = buildStudyView({
  manifest: json<Manifest>('public/data/manifest.json'),
  points: json<PointCollection>('public/data/points.geojson'),
});
const render = (data: StudyView) =>
  renderToStaticMarkup(createElement(ObservationWindow, { study: data, frameRef: null }));

describe('landing NISAR observation', () => {
  it('plots supplied radar samples and dates without substituting optical imagery', () => {
    const html = render(study);
    expect(html.match(/<circle /g)).toHaveLength(study.located.length);
    expect(html).toContain('NISAR · L-band radar');
    expect(html).toContain('13 · 18 · 20 Jul 2026');
    expect(html).toContain('not a continuous radar image');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('Landsat');
    expect(html).not.toContain('NaN');
    for (const sample of study.located) {
      expect(html).toContain(`${sample.nisar_hv_db.toFixed(3)} dB`);
    }
  });

  it('omits absent radar samples instead of inventing a preview', () => {
    expect(render({ ...study, located: [] })).toBe('');
    expect(
      render({
        ...study,
        located: [{ ...study.located[0]!, nisar_hv_db: NaN }],
      }),
    ).toBe('');
  });

  it('handles constant backscatter and missing dates without inventing variation', () => {
    const point = { ...study.located[0]!, nisar_hv_db: -15, nisar_date: null };
    const html = render({ ...study, located: [point] });
    expect(html).toContain('opacity="1"');
    expect(html).toContain('-15.0 (dimmer)');
    expect(html).toContain('-15.0 (brighter)');
    expect(html).toContain('Acquisition dates unavailable');
    expect(html).not.toContain('NaN');
  });
});
