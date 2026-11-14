import { createElement, createRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { INITIAL_MAP_STATE } from '@/app/route';
import { MapNavigationContext } from '@/app/mapNavigation';
import { SiteNav } from '@/components/shell/SiteNav';
import { InvestigationPanel } from './InvestigationPanel';

const panel = (status: 'loading' | 'ready' | 'error', mode: 'examples' | 'search' = 'examples') =>
  renderToStaticMarkup(
    createElement(InvestigationPanel, {
      state: { ...INITIAL_MAP_STATE, mode, presentation: 'explore' },
      catalog: { fires: [], status, retry: () => {} },
      headingRef: createRef<HTMLHeadingElement>(),
      onFireSelect: () => {},
      onPlanet: () => {},
    }),
  );

describe('Map shell accessible states', () => {
  it('distinguishes a genuinely empty catalog from loading and failure', () => {
    expect(panel('ready')).toContain('No example fires have been published yet');
    expect(panel('loading')).toContain('Loading available fires');
    expect(panel('loading')).not.toContain('No example fires have been published yet');
    expect(panel('error')).toContain('Retry catalog');
  });
  it('exposes an operable disclosure and an honest search placeholder', () => {
    const html = panel('ready', 'search');
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('aria-controls="investigation-body"');
    expect(html).toContain('Checking backend availability');
    expect(html).toContain('Search and polygon drawing are not connected');
    expect(html).toContain('View example fires');
    expect(html).not.toContain('Run analysis');
  });
  it('uses the two-page navigation and clears selection in the other workflow link', () => {
    const html = renderToStaticMarkup(
      createElement(
        MapNavigationContext,
        {
          value: { mode: 'examples', presentation: 'fire', fireId: 'bc_2003_490' },
        },
        createElement(SiteNav, { current: 'explore' }),
      ),
    );
    expect(html).toContain('How We Researched');
    expect(html).toContain('#/?view=explore&amp;mode=search');
    expect(html).toContain('aria-current="true"');
    expect(html).not.toContain('#/analyze');
  });
});
