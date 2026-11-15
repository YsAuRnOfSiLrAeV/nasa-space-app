import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  nearestTimelineYear,
  stepTimelineYear,
  timelineRow,
  timelineYearKind,
} from './cellTimeline';

const folder = resolve(
  import.meta.dirname,
  '../../../public/data/bundle-v2/fire_bc_2003_490/summer_2026',
);
const read = (name: string) => JSON.parse(readFileSync(resolve(folder, name), 'utf8'));
const timeline = read('timeline.json') as { years: number[]; recovery_pct: (number | null)[][] };
const cells = (read('cells.json') as { cells: unknown[] }).cells;

/** Three supplied years with a gap, and one cell the model has no value for. */
const sparse = {
  years: [2003, 2010, 2040],
  recovery_pct: [
    [0, null, 12],
    [20, null, 35],
    [70, null, 110],
  ],
};

describe('BC 2003 cell timeline', () => {
  it('reads a year as one value per cell, in the cells’ own order', () => {
    // Cell i = 812 (row 34, col 48): 52% in 2026, 70% in 2040, 87% in 2066.
    expect(timelineRow(timeline, 2026)![812]).toBe(52);
    expect(timelineRow(timeline, 2040)![812]).toBe(70);
    expect(timelineRow(timeline, 2066)![812]).toBe(87);
    expect(timelineRow(timeline, 2026)).toHaveLength(cells.length);
  });

  it('starts at the fire year and ends at the last supplied year', () => {
    expect(timeline.years[0]).toBe(2003);
    expect(timeline.years.at(-1)).toBe(2066);
    expect(stepTimelineYear(timeline, 2003, -1)).toBe(2003);
    expect(stepTimelineYear(timeline, 2066, 1)).toBe(2066);
    expect(stepTimelineYear(timeline, 2026, 1)).toBe(2027);
  });
});

describe('timelines with other year ranges', () => {
  it('uses the years the file supplies, not a fixed range', () => {
    expect(nearestTimelineYear(sparse, 2026)).toBe(2040);
    expect(nearestTimelineYear(sparse, 2006)).toBe(2003);
    expect(nearestTimelineYear(sparse, 1990)).toBe(2003);
    expect(stepTimelineYear(sparse, 2003, 1)).toBe(2010);
    expect(stepTimelineYear(sparse, 2010, 1)).toBe(2040);
    expect(stepTimelineYear(sparse, 2040, 5)).toBe(2040);
    expect(timelineRow(sparse, 2026)).toBeNull();
  });

  it('keeps a missing value missing', () => {
    expect(timelineRow(sparse, 2010)).toEqual([20, null, 35]);
  });

  it('says whether a year is before, at or after the observation summer', () => {
    expect(timelineYearKind(2010, 2026)).toBe('before');
    expect(timelineYearKind(2026, 2026)).toBe('summer');
    expect(timelineYearKind(2040, 2026)).toBe('after');
  });
});
