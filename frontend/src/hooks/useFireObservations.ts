import { useEffect, useState } from 'react';
import type { FireResult } from '@/data/fireSchema';
import type { FireObservations } from '@/data/fireObservations';
import { studyDataApi } from '@/services/data';
import { loadErrorMessage } from './loadErrorMessage';

type State =
  | { status: 'loading' }
  | { status: 'absent' }
  | { status: 'ready'; data: FireObservations }
  | { status: 'error'; message: string };

export function useFireObservations(result: FireResult) {
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<{
    result: FireResult;
    attempt: number;
    state: State;
  } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void studyDataApi
      .loadFireObservations(result, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted)
          setLoaded({
            result,
            attempt,
            state: data ? { status: 'ready', data } : { status: 'absent' },
          });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setLoaded({
            result,
            attempt,
            state: { status: 'error', message: loadErrorMessage(error) },
          });
      });
    return () => controller.abort();
  }, [result, attempt]);
  return {
    state:
      loaded?.result === result && loaded.attempt === attempt
        ? loaded.state
        : ({ status: 'loading' } as State),
    retry: () => setAttempt((n) => n + 1),
  };
}
