import { describe, expect, it } from 'vitest';
import type { FireResult } from '@/data/fireSchema';
import { fireFocusBounds } from './useFireCamera';

const grid = {
  columns: 1,
  rows: 1,
  cell_size_m: 30,
  corners_lonlat: [
    [-5, 5],
    [5, 5],
    [5, -5],
    [-5, -5],
  ],
} satisfies FireResult['map_grid'];

describe('fire camera bounds', () => {
  it('fits a supplied perimeter before falling back to the result grid', () => {
    const perimeter: NonNullable<FireResult['fire']['perimeter']> = {
      type: 'Polygon',
      coordinates: [
        [
          [-120, 40],
          [-110, 40],
          [-110, 50],
          [-120, 50],
          [-120, 40],
        ],
      ],
    };

    expect(fireFocusBounds(perimeter, grid)).toEqual([
      [-120, 40],
      [-110, 50],
    ]);
    expect(fireFocusBounds(null, grid)).toEqual([
      [-5, -5],
      [5, 5],
    ]);
  });
});
