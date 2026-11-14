import { useEffect, useState } from 'react';
import { backendApi } from '@/services/api';
import type { BackendStatus } from '@/services/api/BackendApi';

export function useBackendStatus(enabled: boolean) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ attempt: number; status: BackendStatus } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    void backendApi
      .status(controller.signal)
      .then((status) => {
        if (!controller.signal.aborted) setResult({ attempt, status });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setResult({ attempt, status: { state: 'offline', reason: 'the health check failed' } });
      });
    return () => controller.abort();
  }, [enabled, attempt]);
  return {
    status: result?.attempt === attempt ? result.status : null,
    retry: () => setAttempt((value) => value + 1),
  };
}
