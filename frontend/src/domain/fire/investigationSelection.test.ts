import { describe, expect, it } from 'vitest';
import { selectionForFire } from './investigationSelection';
import { drawnOverlays } from './overlays';

describe('fire investigation state', () => {
  const selected = { fireId: 'A', cell: 10, year: 2040 };
  it('preserves the selection during same-fire layer and data updates', () => {
    expect(selectionForFire(selected, 'A')).toBe(selected);
  });
  it('clears cell and year on another fire, closing, and returning to a previous fire', () => {
    const next = selectionForFire(selected, 'B');
    expect(next).toEqual({ fireId: 'B', cell: null, year: null });
    expect(selectionForFire(next, 'A')).toEqual({ fireId: 'A', cell: null, year: null });
    expect(selectionForFire(selected, null)).toEqual({ fireId: null, cell: null, year: null });
  });
  it('omits unavailable overlays and undecodable optical imagery from the legend', () => {
    const requested = { perimeter: true, zone: true, gedi: false, optical: true };
    const available = { perimeter: true, zone: false, gedi: true, optical: true };
    expect(drawnOverlays(requested, available, false)).toEqual({
      perimeter: true,
      zone: false,
      gedi: false,
      optical: false,
    });
    expect(drawnOverlays(requested, available, true).optical).toBe(true);
  });
});
