import { createElement, createRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { DemoFire } from '@/data/fireSchema';
import type { FireInvestigationState } from '@/hooks/useFireInvestigation';
import { FireBottomBar } from './FireBottomBar';
import { FireCatalogList } from './FireCatalogList';
import { FireSettingsPanel } from './FireSettingsPanel';
import { OtherFiresMenu } from './OtherFiresMenu';
import { Presence } from './Presence';
import { mapStateOf, parseRoute } from '@/app/route';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { FireCellsSchema, FireResultSchema, type FireData } from '@/data/fireSchema';

const fire = (id: string, year: number, region: string): DemoFire => ({
  id,
  name: { en: id, uk: '' },
  year,
  area_ha: 100,
  summer: 2026,
  center_lonlat: [-100, 55],
  recovery_today_avg: null,
  area_recovered_80pct: null,
  year_80pct: null,
  result: `${id}/result.json`,
  region,
});
const catalog = {
  state: {
    status: 'ready' as const,
    data: [fire('bc_2003_490', 2003, 'bc'), fire('quebec_1995_1218', 1995, 'quebec')],
  },
  retry: () => {},
};
/** A selected fire still loading: enough for the shell, no fire data yet. */
const loading = {
  fireId: 'bc_2003_490',
  fire: { status: 'loading' },
  data: null,
  forecast: null,
  forecastYear: null,
  timelineYear: null,
  overlays: {},
} as unknown as FireInvestigationState;
const demoFirePath = resolve(import.meta.dirname, '../../../public/data/demo/bc_2003_490');
const demoData: FireData = {
  result: FireResultSchema.parse(
    JSON.parse(readFileSync(resolve(demoFirePath, 'result.json'), 'utf8')),
  ),
  cells: FireCellsSchema.parse(
    JSON.parse(readFileSync(resolve(demoFirePath, 'cells.json'), 'utf8')),
  ),
  opticalImageUrl: null,
};

describe('explorer with a fire open', () => {
  it('combines country grouping and readable names with retained region/year browsing', () => {
    const html = renderToStaticMarkup(
      createElement(FireCatalogList, {
        catalog: {
          ...catalog,
          state: {
            status: 'ready',
            data: [fire('ukraine_2020_3009_5131', 2020, 'ukraine'), ...catalog.state.data],
          },
        },
        selectedId: null,
        onSelect: () => {},
      }),
    );
    expect(html).toContain('Canada');
    expect(html).toContain('British Columbia');
    expect(html).toContain('aria-label="bc, 2003"');
    expect(html.indexOf('Canada')).toBeLessThan(html.indexOf('Ukraine'));
    expect(html).toContain('3 of 3 fires');
  });
  it('keeps the list’s search and filters when they are held by the explorer', () => {
    const html = renderToStaticMarkup(
      createElement(FireCatalogList, {
        catalog,
        selectedId: null,
        onSelect: () => {},
        filters: [{ query: 'quebec', region: '', year: '' }, () => {}],
      }),
    );
    expect(html).toContain('value="quebec"');
    expect(html).toContain('1 of 2 fires');
    expect(html).toContain('quebec_1995_1218');
    expect(html).not.toContain('>bc_2003_490');
  });

  it('returns to Examples without a selected fire', () => {
    const html = renderToStaticMarkup(
      createElement(OtherFiresMenu, { href: '#/explore?mode=examples' }),
    );
    expect(html).toContain('href="#/explore?mode=examples"');
    expect(mapStateOf(parseRoute('#/explore?mode=examples'))).toEqual({
      mode: 'examples',
      presentation: 'explore',
      fireId: null,
    });
    expect(html).not.toContain('Search identifier');
  });

  it('keeps the right panel focused on map settings', () => {
    const html = renderToStaticMarkup(
      createElement(FireSettingsPanel, {
        investigation: loading,
        headingRef: createRef<HTMLHeadingElement>(),
      }),
    );
    expect(html).toContain('<h2 tabindex="-1">Map settings</h2>');
    expect(html).toContain('Collapse');
    expect(html).not.toContain('Fit fire');
    expect(html).not.toContain('Close fire');
    expect(html).toContain('Loading the fire result and grid');
  });

  it('shows no year slider in the bottom bar without a forecast', () => {
    const html = renderToStaticMarkup(
      createElement(FireBottomBar, {
        investigation: loading,
        entry: catalog.state.data[0],
        curve: null,
        year: null,
        onYear: () => {},
        cells: null,
        onFit: () => {},
        closeHref: '#/?view=explore&mode=examples',
      }),
    );
    expect(html).toContain('British Columbia, 2003');
    expect(html).not.toContain('Selected fire');
    expect(html).not.toContain('#490');
    expect(html).not.toContain('type="range"');
    expect(html).toContain('Fit fire');
    expect(html).toContain('Close fire');
    expect(html).toContain('href="#/?view=explore&amp;mode=examples"');
  });

  it('keeps only fire area and modeled recovery in the compact summary', () => {
    const html = renderToStaticMarkup(
      createElement(FireBottomBar, {
        investigation: { ...loading, data: demoData },
        entry: catalog.state.data[0],
        curve: null,
        year: null,
        onYear: () => {},
        cells: null,
        onFit: null,
        closeHref: '#/?view=explore&mode=examples',
      }),
    );
    expect(html).toContain('Fire area');
    expect(html).toContain('Modeled recovery');
    expect(html).not.toContain('Reference forest height');
    expect(html).not.toContain('GEDI measurements');
    expect(html).toContain('Close fire');
    expect(html).not.toContain('Fit fire');
  });

  it('names the fire with a comma and gives the year it reaches 80%', () => {
    const ready = {
      ...loading,
      fireId: 'ontario_1988_21',
      data: {
        result: {
          fire: { year: 1988, area_ha: 7899 },
          satellite_images: { summer: 2026 },
          model_result: { recovery_today_avg: null },
        },
        bundle: { forecast: { kind: 'growth', now_recovery: 0.83, year_80pct: 2019 } },
      },
    } as unknown as FireInvestigationState;
    const bar = (year80: number) =>
      renderToStaticMarkup(
        createElement(FireBottomBar, {
          investigation: ready,
          entry: undefined,
          closeHref: '#/',
          onFit: null,
          curve: null,
          year: null,
          onYear: () => {},
          cells: null,
          ...(year80 === 2019 ? {} : {}),
        }),
      );
    const html = bar(2019);
    expect(html).toContain('Ontario, 1988');
    expect(html).not.toContain('|');
    expect(html).toContain('Modeled 80% recovery');
    expect(html).toContain('reached 2019');
  });

  it('renders nothing for a panel that is not shown', () => {
    expect(renderToStaticMarkup(createElement(Presence, { show: false, children: 'Panel' }))).toBe(
      '',
    );
    expect(
      renderToStaticMarkup(createElement(Presence, { show: true, children: 'Panel' })),
    ).toContain('data-state="open"');
  });
});
