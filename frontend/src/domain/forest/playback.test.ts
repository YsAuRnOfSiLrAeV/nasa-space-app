import { describe, expect, it } from 'vitest';
import { initialPlayback, playbackReducer, type Playback, type PlaybackAction } from './playback';

const run = (s: Playback, ...actions: PlaybackAction[]) => actions.reduce(playbackReducer, s);

describe('growth playback', () => {
  const start = initialPlayback(5, 30);

  it('starts paused, with the initial year clamped into range', () => {
    expect(start).toEqual({ year: 5, playing: false, max: 30 });
    expect(initialPlayback(44, 30).year).toBe(30);
    expect(initialPlayback(-2, 30).year).toBe(0);
  });

  it('advances one year per tick while playing and stops at the last year', () => {
    const playing = run(start, { type: 'toggle' });
    expect(run(playing, { type: 'tick' })).toMatchObject({ year: 6, playing: true });
    const atEnd = run({ ...playing, year: 29 }, { type: 'tick' }, { type: 'tick' });
    expect(atEnd).toMatchObject({ year: 30, playing: false });
  });

  it('plays again from the fire when started at the last year', () => {
    expect(run({ ...start, year: 30 }, { type: 'toggle' })).toMatchObject({
      year: 0,
      playing: true,
    });
  });

  it('pauses on seek and reset, but not on previous / next', () => {
    const playing = run(start, { type: 'toggle' });
    expect(run(playing, { type: 'step', by: 1 })).toMatchObject({ year: 6, playing: true });
    expect(run(playing, { type: 'seek', year: 12 })).toMatchObject({ year: 12, playing: false });
    expect(run(playing, { type: 'reset' })).toMatchObject({ year: 0, playing: false });
  });

  it('never leaves 0 … max', () => {
    expect(run(start, { type: 'step', by: -10 }).year).toBe(0);
    expect(run(start, { type: 'step', by: 99 }).year).toBe(30);
    expect(run(start, { type: 'seek', year: 31 }).year).toBe(30);
  });
});
