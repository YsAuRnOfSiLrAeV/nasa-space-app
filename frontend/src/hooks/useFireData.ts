import { useEffect, useState } from 'react';
import type { FireData } from '@/data/fireSchema';
import { studyDataApi } from '@/services/data';
import { loadErrorMessage } from './loadErrorMessage';

type FireState =
  | { status: 'loading' }
  | { status: 'absent' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: FireData };

const results = new Map<string, FireData>();

export function useFireData(fireId: string) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ id: string; attempt: number; value: FireState } | null>(
    null,
  );
  useEffect(() => {
    const controller = new AbortController();
    // Static exports are immutable during a visit. Retry explicitly bypasses cache.
    const request =
      attempt === 0 && results.has(fireId)
        ? Promise.resolve(results.get(fireId)!)
        : studyDataApi.loadFire(fireId, controller.signal);
    void request
      .then((data) => {
        if (!controller.signal.aborted) {
          if (data) results.set(fireId, data);
          setState({
            id: fireId,
            attempt,
            value: data ? { status: 'ready', data } : { status: 'absent' },
          });
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setState({
            id: fireId,
            attempt,
            value: { status: 'error', message: loadErrorMessage(error) },
          });
      });
    return () => controller.abort();
  }, [fireId, attempt]);
  return {
    state:
      state?.id === fireId && state.attempt === attempt
        ? state.value
        : results.has(fireId)
          ? ({ status: 'ready', data: results.get(fireId)! } as FireState)
          : ({ status: 'loading' } as FireState),
    retry: () => setAttempt((value) => value + 1),
  };
}
