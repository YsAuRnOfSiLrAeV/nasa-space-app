import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GridLayerPicker, OverlayToggles } from './FireControls';
import type { OpticalStatus } from '@/hooks/useOpticalImage';

const render = (optical: OpticalStatus) =>
  renderToStaticMarkup(
    <OverlayToggles
      overlays={{ perimeter: true, zone: true, gedi: true, optical: true }}
      available={{ perimeter: true, zone: false, gedi: false, optical: true }}
      optical={optical}
      onChange={() => {}}
    />,
  );

describe('fire overlay availability', () => {
  it('disables grid controls when no scientific values were supplied', () => {
    const empty = { total: 1, valued: 0, outside: 0 };
    const html = renderToStaticMarkup(
      <GridLayerPicker
        layer="probability"
        coverage={{ probability: empty, stage: empty }}
        onLayer={() => {}}
      />,
    );
    expect([...html.matchAll(/<input[^>]*>/g)].every(([input]) => input.includes('disabled'))).toBe(
      true,
    );
    expect(html).toContain('no values supplied');
  });
  it.each([
    ['none', 'No optical image supplied'],
    ['loading', 'Loading optical image'],
    ['missing', 'could not be loaded'],
  ] as const)('disables optical imagery with its %s explanation', (state, reason) => {
    const html = render(state);
    expect(html).toContain(reason);
    const inputs = [...html.matchAll(/<input[^>]*>/g)].map((match) => match[0]);
    expect(inputs[3]).toContain('disabled');
    expect(inputs[3]).not.toContain('checked');
  });
  it('enables a decoded image while keeping absent geographic overlays disabled', () => {
    const html = render('ready');
    const inputs = [...html.matchAll(/<input[^>]*>/g)].map((match) => match[0]);
    expect(inputs[0]).toContain('checked');
    expect(inputs[1]).toContain('disabled');
    expect(inputs[2]).toContain('disabled');
    expect(inputs[3]).toContain('checked');
    expect(inputs[3]).not.toContain('disabled');
    expect(html).toContain('No reference cells supplied');
    expect(html).toContain('No GEDI footprints supplied');
  });
});
