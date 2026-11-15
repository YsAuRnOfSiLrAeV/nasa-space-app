import { loadErrorMessage } from './loadErrorMessage';

export type Resource<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'absent' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: T };

export interface ResourceResult<T> {
  key: string;
  attempt: number;
  value: Resource<T>;
}

/** Select only a result for this resource and retry; never flash a previous key's data. */
export function resourceState<T>(
  key: string | null,
  attempt: number,
  settled: ResourceResult<T> | null,
  peek?: (key: string) => T | undefined,
): Resource<T> {
  if (key === null) return { status: 'idle' };
  if (settled?.key === key && settled.attempt === attempt) return settled.value;
  const cached = attempt === 0 ? peek?.(key) : undefined;
  return cached === undefined ? { status: 'loading' } : { status: 'ready', data: cached };
}

/** Cancellation also suppresses late results from loaders that ignore AbortSignal. */
export function startResourceRequest<T>(
  load: (signal: AbortSignal) => Promise<T | null | undefined>,
  settle: (state: Resource<T>) => void,
) {
  const controller = new AbortController();
  const publish = (state: Resource<T>) => {
    if (!controller.signal.aborted) settle(state);
  };
  const done = Promise.resolve()
    .then(() => (controller.signal.aborted ? undefined : load(controller.signal)))
    .then((data) => publish(data == null ? { status: 'absent' } : { status: 'ready', data }))
    .catch((error: unknown) => publish({ status: 'error', message: loadErrorMessage(error) }));
  return { done, cancel: () => controller.abort() };
}
