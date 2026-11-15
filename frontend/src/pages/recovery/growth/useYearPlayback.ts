import { useEffect, useReducer } from 'react';
import { initialPlayback, playbackReducer } from '@/domain/forest/playback';

export interface YearPlayback {
  year: number;
  playing: boolean;
  max: number;
  toggle: () => void;
  step: (by: number) => void;
  seek: (year: number) => void;
  reset: () => void;
}

/** Year playback state (rules in the tested `playbackReducer`) plus the timer that advances it. */
export function useYearPlayback(initial: number, max: number, stepMs = 1100): YearPlayback {
  const [s, dispatch] = useReducer(playbackReducer, initialPlayback(initial, max));

  useEffect(() => {
    if (!s.playing) return;
    const id = setInterval(() => dispatch({ type: 'tick' }), stepMs);
    return () => clearInterval(id);
  }, [s.playing, stepMs]);

  return {
    ...s,
    toggle: () => dispatch({ type: 'toggle' }),
    step: (by) => dispatch({ type: 'step', by }),
    seek: (year) => dispatch({ type: 'seek', year }),
    reset: () => dispatch({ type: 'reset' }),
  };
}
