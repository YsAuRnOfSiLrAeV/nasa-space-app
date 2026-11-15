import { useEffect, useRef, useState } from 'react';
import {
  resourceState,
  startResourceRequest,
  type Resource,
  type ResourceResult,
} from './resourceRequest';
export type { Resource } from './resourceRequest';

/**
 * The one loading state machine under every data hook: cancels a superseded
 * request, never shows a result that belongs to another key, and retries on demand.
 *
 * @param key  What is being loaded; `null` loads nothing (`idle`). A new key starts a new load.
 * @param load Reads from a service. `fresh` is true on a retry, so a cache can be bypassed.
 *             Resolving `null` or `undefined` means `absent`.
 * @param peek An already-available value for a key (e.g. a service cache), shown without a
 *             loading state.
 */
export function useResource<T>(
  key: string | null,
  load: (signal: AbortSignal, fresh: boolean) => Promise<T | null | undefined>,
  peek?: (key: string) => T | undefined,
): { state: Resource<T>; retry: () => void } {
  const [retried, setRetried] = useState<{ key: string; count: number } | null>(null);
  const attempt = retried && retried.key === key ? retried.count : 0;
  const [settled, setSettled] = useState<ResourceResult<T> | null>(null);
  // The latest loader, without restarting the request when its identity changes.
  const loader = useRef(load);
  useEffect(() => {
    loader.current = load;
  });

  useEffect(() => {
    if (key === null) return;
    const request = startResourceRequest(
      (signal) => loader.current(signal, attempt > 0),
      (value) => setSettled({ key, attempt, value }),
    );
    return request.cancel;
  }, [key, attempt]);

  return {
    state: resourceState(key, attempt, settled, peek),
    retry: () => {
      if (key !== null)
        setRetried((previous) => ({
          key,
          count: previous?.key === key ? previous.count + 1 : 1,
        }));
    },
  };
}
