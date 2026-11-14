import { useEffect, useState } from 'react';
import type { CanadianContext } from '@/data/contextSchema';
import { studyDataApi } from '@/services/data';
import { loadErrorMessage } from './loadErrorMessage';

export function useCanadianContext(fireId: string) {
  const [state, setState] = useState<{
    id: string;
    data: CanadianContext | null;
    error: string | null;
  } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void studyDataApi
      .loadCanadianContext(fireId, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ id: fireId, data, error: null });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setState({ id: fireId, data: null, error: loadErrorMessage(error) });
      });
    return () => controller.abort();
  }, [fireId]);
  return state?.id === fireId
    ? { ...state, loading: false }
    : { data: null, error: null, loading: true };
}
