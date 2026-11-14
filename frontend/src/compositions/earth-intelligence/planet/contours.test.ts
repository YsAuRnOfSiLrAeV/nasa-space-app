import { describe, expect, it } from 'vitest';
import { groundHeight, traceContours } from './contours';

describe('decorative contour ground', () => {
  it('is deterministic', () => {
    expect(groundHeight(0.3, 0.4, 1.6)).toBe(groundHeight(0.3, 0.4, 1.6));
    expect(traceContours(320, 200)).toEqual(traceContours(320, 200));
  });

  it('keeps every segment inside the surface', () => {
    const { minor, index } = traceContours(320, 200);
    for (const v of [...minor, ...index]) expect(Number.isFinite(v)).toBe(true);
    for (let i = 0; i < minor.length; i += 2) {
      expect(minor[i]).toBeGreaterThanOrEqual(0);
      expect(minor[i + 1]).toBeGreaterThanOrEqual(0);
    }
  });

  it('gathers relief toward the lower edge', () => {
    const { minor } = traceContours(400, 400);
    let top = 0;
    let bottom = 0;
    for (let i = 1; i < minor.length; i += 2) {
      if (minor[i]! < 120) top++;
      else if (minor[i]! > 280) bottom++;
    }
    expect(bottom).toBeGreaterThan(top * 1.5);
  });
});
