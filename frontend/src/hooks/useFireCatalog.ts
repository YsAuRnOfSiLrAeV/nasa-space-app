import { useEffect, useState } from 'react';
import type { DemoFire } from '@/data/fireSchema';
import { studyDataApi } from '@/services/data';

export function useFireCatalog() {
  const [fires, setFires] = useState<DemoFire[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void studyDataApi
      .loadFireIndex(controller.signal)
      .then((entries) => {
        if (!controller.signal.aborted) {
          setFires(entries);
          setStatus('ready');
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus('error');
      });
    return () => controller.abort();
  }, [attempt]);
  return {
    fires,
    status,
    retry: () => {
      setStatus('loading');
      setAttempt((v) => v + 1);
    },
  };
}
export type FireCatalog = ReturnType<typeof useFireCatalog>;
