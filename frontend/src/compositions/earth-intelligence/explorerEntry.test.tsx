import { Children, isValidElement, createRef, type ReactNode, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { changeMapMode, INITIAL_MAP_STATE, mapHref, mapStateOf, parseRoute } from '@/app/route';
import { MapNavigationContext } from '@/app/mapNavigation';
import { SiteNav } from '@/components/shell/SiteNav';
import { InvestigationPanel } from './InvestigationPanel';
import { PolygonDrawingControls } from './PolygonDrawingControls';
import type { PolygonDraft } from '@/hooks/usePolygonDraft';
import type { StudyMapController } from '@/components/map/StudyMapController';
import { groupFireCatalog } from '@/domain/fire/catalogSearch';
import { FireIndexSchema } from '@/data/fireSchema';

const browse = { mode: 'examples' as const, presentation: 'explore' as const, fireId: null };
const start = {
  mode: 'find-your-fire' as const,
  presentation: 'explore' as const,
  fireId: null,
  draw: true as const,
};
const catalog = { state: { status: 'ready' as const, data: [] }, retry: () => {} };

describe('Landing to Explorer entry', () => {
  it('opens browsing or drawing in one navigation, without selecting a fire', () => {
    expect(changeMapMode(INITIAL_MAP_STATE, 'examples')).toEqual(browse);
    expect(changeMapMode(INITIAL_MAP_STATE, 'find-your-fire')).toEqual(start);
    const html = renderToStaticMarkup(
      <MapNavigationContext value={INITIAL_MAP_STATE}>
        <SiteNav current="explore" />
      </MapNavigationContext>,
    );
    expect(html).toContain('href="#/explore?mode=examples"');
    expect(html).toContain('href="#/explore?mode=find-your-fire&amp;draw=1"');
    expect(html).toMatch(/href="#\/research"[^>]*class="[^"]*prominent/);
    expect(html).not.toContain('aria-current="true"');
  });
  it('round-trips both entry paths, selection and Back/Forward URLs independently', () => {
    const selected = { ...browse, presentation: 'fire' as const, fireId: 'bc_2003_490' };
    const history = [INITIAL_MAP_STATE, browse, start, selected, start, browse, INITIAL_MAP_STATE];
    for (const state of [...history, ...history.toReversed()])
      expect(mapStateOf(parseRoute(mapHref(state)))).toEqual(state);
    expect(mapStateOf(parseRoute('#/explore?mode=find-your-fire'))).toEqual({
      ...browse,
      mode: 'find-your-fire',
    });
    expect(mapStateOf(parseRoute('#/?view=explore&mode=search'))).toEqual({
      ...browse,
      mode: 'find-your-fire',
    });
    expect(mapStateOf(parseRoute('#/explore'))).toEqual(browse);
  });
  it('puts a prominent drawing link before the example list and provides a return path', () => {
    const render = (state: typeof browse | typeof start) =>
      renderToStaticMarkup(
        <InvestigationPanel
          state={state}
          catalog={catalog}
          headingRef={createRef()}
          onFireSelect={() => {}}
          onPlanet={() => {}}
        />,
      );
    const html = render(browse);
    expect(html).toContain(`href="${mapHref(start).replaceAll('&', '&amp;')}"`);
    expect(html.indexOf('Draw Your Polygon')).toBeLessThan(html.indexOf('Available example fires'));
    expect(render(start)).toContain('href="#/explore?mode=examples"');
    expect(render(start)).toContain('Browse Examples');
  });
  it('groups only supplied fires by region and descending year without selecting one', () => {
    const fires = FireIndexSchema.parse(
      ['b', 'a', 'c'].map((id, i) => ({
        id,
        name: { en: id },
        year: [1995, 2010, 1995][i],
        region: ['quebec', 'bc', 'quebec'][i],
        summer: 2026,
        area_ha: null,
        center_lonlat: [-100, 55],
        recovery_today_avg: null,
        year_80pct: null,
        result: `${id}/result.json`,
      })),
    );
    const groups = groupFireCatalog(fires);
    expect(groups.map((group) => group.region)).toEqual(['bc', 'quebec']);
    expect(groups.flatMap((group) => group.years.flatMap((year) => year.fires))).toHaveLength(3);
    expect(groups[1]!.years[0]!.fires.map((fire) => fire.id)).toEqual(['b', 'c']);
  });
});

type Button = { children?: ReactNode; onClick?: () => void; disabled?: boolean };
function buttons(node: ReactNode): ReactElement<Button>[] {
  return Children.toArray(node).flatMap((child) => {
    if (!isValidElement<Button>(child)) return [];
    return child.type === 'button' ? [child] : buttons(child.props.children);
  });
}
function draftState(): PolygonDraft {
  const draft: PolygonDraft = {
    drawing: false,
    points: [],
    polygon: {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 0],
        ],
      ],
    },
    setDrawing: (next) => {
      draft.drawing = typeof next === 'function' ? next(draft.drawing) : next;
    },
    setPoints: (next) => {
      draft.points = typeof next === 'function' ? next(draft.points) : next;
    },
    setPolygon: (next) => {
      draft.polygon = typeof next === 'function' ? next(draft.polygon) : next;
    },
  };
  return draft;
}
describe('shared polygon actions', () => {
  const map = { centre: () => [2, 3] } as unknown as StudyMapController;
  it('starts drawing, adds keyboard vertices, and cancels without discarding the previous polygon', () => {
    const draft = draftState();
    const previous = draft.polygon;
    const get = (name: string) =>
      buttons(PolygonDrawingControls({ draft, mapView: map, busy: false, onFinish: vi.fn() })).find(
        (button) => button.props.children === name,
      )!.props;
    get('Draw Polygon').onClick!();
    expect(draft.drawing).toBe(true);
    expect(draft.polygon).toBe(previous);
    expect(get('Finish Drawing').disabled).toBe(true);
    for (let i = 0; i < 3; i++) get('Add map centre').onClick!();
    expect(draft.points).toEqual([
      [2, 3],
      [2, 3],
      [2, 3],
    ]);
    expect(get('Finish Drawing').disabled).toBe(false);
    get('Cancel drawing').onClick!();
    expect(draft.drawing).toBe(false);
    expect(draft.points).toEqual([]);
    expect(draft.polygon).toBe(previous);
    get('Clear Selection').onClick!();
    expect(draft.polygon).toBeNull();
  });
  it('shows the same four primary actions and honest unsupported analysis before catalog browsing', () => {
    const html = renderToStaticMarkup(
      <PolygonDrawingControls
        draft={draftState()}
        mapView={map}
        busy={false}
        onFinish={() => {}}
      />,
    );
    for (const label of ['Draw Polygon', 'Finish Drawing', 'Clear Selection', 'Analyze Area'])
      expect(html).toContain(label);
    expect(html).toMatch(
      /<button[^>]*disabled=""[^>]*aria-describedby="area-analysis-unavailable"[^>]*>Analyze Area/,
    );
    expect(html).toContain('backend does not support submission');
  });
});
