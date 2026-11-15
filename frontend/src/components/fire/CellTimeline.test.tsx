import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CellTimelineControls } from './CellTimeline';

const timeline = {
  years: [1995, 1996, 1997, 2026, 2027, 2060],
  recovery_pct: [[0], [3], [6], [60], [62], [null]],
};
const render = (year: number | null) =>
  renderToStaticMarkup(
    createElement(CellTimelineControls, { timeline, year, summer: 2026, onYear: () => {} }),
  );

describe('cell timeline controls', () => {
  it('explains that every year is modeled, with the fire’s own first and last year', () => {
    const html = render(null);
    expect(html).toContain('Recovery through time');
    expect(html).toContain('from 1995 to 2060');
    expect(html).toContain('Every year is a model estimate, including the years before 2026');
    expect(html).toContain('none of them is an observation');
    expect(html).toContain('separate from the whole-fire');
  });

  it('shows only the switch while the timeline is off', () => {
    const html = render(null);
    expect(html).toContain('Show modeled cell recovery');
    expect(html).not.toContain('type="range"');
    expect(html).not.toContain('Previous year');
  });

  it('shows the current modeled year prominently, with what kind of estimate it is', () => {
    expect(render(2026)).toMatch(/<output[^>]*>2026<\/output>/);
    expect(render(2026)).toContain('Modeled state at the observation summer');
    expect(render(1996)).toContain('Modeled back from the observation summer');
    expect(render(2060)).toContain('Modeled projection');
  });

  it('steps through the supplied years by position, not by calendar arithmetic', () => {
    const html = render(2026);
    // Six supplied years: the slider runs over positions 0..5 and 2026 is the fourth.
    expect(html).toMatch(/type="range"[^>]*min="0"[^>]*max="5"/);
    expect(html).toMatch(/type="range"[^>]*value="3"/);
    expect(html).toContain('aria-valuetext="2026, modeled state at the observation summer"');
    expect(html).toContain('Previous year');
    expect(html).toContain('Play');
    expect(html).toContain('Next year');
  });

  it('stops at the first and the last supplied year', () => {
    expect(render(1995)).toMatch(/<button[^>]*disabled=""[^>]*>Previous year/);
    expect(render(1995)).not.toMatch(/<button[^>]*disabled=""[^>]*>Next year/);
    expect(render(2060)).toMatch(/<button[^>]*disabled=""[^>]*>Next year/);
  });

  it('snaps a year the timeline does not have to the nearest supplied one', () => {
    expect(render(2010)).toMatch(/<output[^>]*>1997<\/output>/);
  });
});
