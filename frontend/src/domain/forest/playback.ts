/**
 * Year playback for the growth illustration (pure, tested): which year is
 * shown and whether it is advancing. The hook `useYearPlayback` runs the timer.
 */

export interface Playback {
  year: number;
  playing: boolean;
  /** Last year (inclusive); the first is 0. */
  max: number;
}

export type PlaybackAction =
  /** Play or pause; playing from the last year starts again at 0. */
  | { type: 'toggle' }
  /** Timer step: one year on, or stop once the last year is shown. */
  | { type: 'tick' }
  /** Previous / next year; playback continues. */
  | { type: 'step'; by: number }
  /** Jump to a year (slider); pauses. */
  | { type: 'seek'; year: number }
  /** Back to the fire; pauses. */
  | { type: 'reset' };

const clamp = (y: number, max: number) => Math.max(0, Math.min(max, Math.round(y)));

export function initialPlayback(year: number, max: number): Playback {
  return { year: clamp(year, max), playing: false, max };
}

export function playbackReducer(s: Playback, a: PlaybackAction): Playback {
  switch (a.type) {
    case 'toggle':
      return !s.playing && s.year >= s.max
        ? { ...s, year: 0, playing: true }
        : { ...s, playing: !s.playing };
    case 'tick':
      return s.year >= s.max ? { ...s, playing: false } : { ...s, year: s.year + 1 };
    case 'step':
      return { ...s, year: clamp(s.year + a.by, s.max) };
    case 'seek':
      return { ...s, year: clamp(a.year, s.max), playing: false };
    case 'reset':
      return { ...s, year: 0, playing: false };
  }
}
