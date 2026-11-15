import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FireCellsSchema, FireResultSchema, type FireData } from '@/data/fireSchema';
import { CellInspector } from './CellInspector';

const DEMO = resolve(import.meta.dirname, '../../../public/data/demo/quebec_2010_fixture');
const data: FireData = {
  result: FireResultSchema.parse(JSON.parse(readFileSync(resolve(DEMO, 'result.json'), 'utf8'))),
  cells: FireCellsSchema.parse(JSON.parse(readFileSync(resolve(DEMO, 'cells.json'), 'utf8'))),
  opticalImageUrl: null,
};
const html = (cell: number | null, layer: 'stage' | 'probability' = 'stage') =>
  renderToStaticMarkup(
    createElement(CellInspector, { data, layer, cell, onCell: () => {}, onShowOnMap: () => {} }),
  );

describe('keyboard cell inspector', () => {
  it('offers a captioned count table and labelled row/column spinbuttons', () => {
    const out = html(null);
    expect(out).toContain('<table');
    expect(out).toContain('<caption>');
    expect(out).toContain('scope="col"');
    expect(out).not.toContain('Outside the model’s domain');
    expect(out).toMatch(/<label>Row<input type="number"[^>]*max="60"/);
    expect(out).toContain('Next cell with data');
    expect(out).toContain('aria-live="polite"');
  });

  it('starts on the first cell with data and describes it by category only', () => {
    const out = html(null, 'probability');
    const first = data.cells.model.stage.findIndex((v) => v !== null);
    // The row and column are in the inspector's own fields, not repeated in the readout title.
    expect(out).toMatch(new RegExp(`<label>Row<input[^>]*value="${Math.floor(first / 60) + 1}"`));
    expect(out).not.toContain(`row ${Math.floor(first / 60) + 1}, column`);
    const p = data.cells.model.p_forest_gt5[first]!;
    const readout = out.slice(out.indexOf('<output'));
    expect(readout).not.toContain(`${p}%`);
    expect(readout).toMatch(/Low|Medium|High/);
  });

  it('reports an empty cell as missing, not interpolated', () => {
    expect(html(0)).toContain('Missing cells are not interpolated');
  });
});
