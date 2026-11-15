/**
 * The cell timeline of a supplied fire: modeled recovery of every cell, by year
 * (`timeline.json`, `recovery_pct[yearIndex][cellIndex]`). Pure and DOM-free.
 *
 * Every year is a model estimate projected from the observation summer, including
 * the years before it. A `null` is a cell the model has no value for in that year:
 * it stays null here and is drawn empty, never filled in.
 */
import type { FireTimeline } from '@/data/fireTypes';

type Timeline = Pick<FireTimeline, 'years' | 'recovery_pct'>;

/** Every cell's value for a year, in `cells.json` order; null when the timeline has no such year. */
export function timelineRow(timeline: Timeline, year: number): (number | null)[] | null {
  const index = timeline.years.indexOf(year);
  return index < 0 ? null : (timeline.recovery_pct[index] ?? null);
}

/** The supplied year closest to `year` (the earlier one on a tie). Years need not be contiguous. */
export function nearestTimelineYear(timeline: Timeline, year: number): number {
  return timeline.years.reduce((best, candidate) =>
    Math.abs(candidate - year) < Math.abs(best - year) ? candidate : best,
  );
}

/** The supplied year `by` positions away from `year`, stopping at the first and last year. */
export function stepTimelineYear(timeline: Timeline, year: number, by: number): number {
  const from = timeline.years.indexOf(nearestTimelineYear(timeline, year));
  const to = Math.max(0, Math.min(timeline.years.length - 1, from + by));
  return timeline.years[to]!;
}

/** What kind of estimate a timeline year is, relative to the observation summer. */
export function timelineYearKind(year: number, summer: number): 'before' | 'summer' | 'after' {
  return year < summer ? 'before' : year === summer ? 'summer' : 'after';
}
