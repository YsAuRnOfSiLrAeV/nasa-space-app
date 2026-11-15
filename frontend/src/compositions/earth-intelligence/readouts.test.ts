import { describe, expect, it } from 'vitest';
import { formatAcquisitionDates, regionPlot } from './readouts';

describe('acquisition dates readout', () => {
  it('compacts dates that share a month, in date order', () => {
    expect(formatAcquisitionDates(['2026-07-18', '2026-07-13', '2026-07-20'])).toBe(
      '13 · 18 · 20 Jul 2026',
    );
  });
  it('writes each date in full across months', () => {
    expect(formatAcquisitionDates(['2026-07-30', '2026-08-02'])).toBe('30 Jul 2026 · 2 Aug 2026');
  });
  it('keeps unparseable values as given and leaves missing data missing', () => {
    expect(formatAcquisitionDates(['July 2026'])).toBe('July 2026');
    expect(formatAcquisitionDates([])).toBeNull();
  });
});

describe('region plot', () => {
  const bbox = [-95.5, 49.56, -92.51, 51.5] as const;
  it('keeps the true shape: longitude shrinks with cos(latitude)', () => {
    const { height } = regionPlot(bbox, 300);
    const k = Math.cos((50.53 * Math.PI) / 180);
    expect(height).toBeCloseTo((300 * 1.94) / (2.99 * k), 6);
  });
  it('maps the corners to the frame corners', () => {
    const { at, height } = regionPlot(bbox, 300);
    expect(at(-95.5, 51.5)).toEqual({ x: 0, y: 0 });
    const se = at(-92.51, 49.56);
    expect(se.x).toBeCloseTo(300);
    expect(se.y).toBeCloseTo(height);
  });
});
