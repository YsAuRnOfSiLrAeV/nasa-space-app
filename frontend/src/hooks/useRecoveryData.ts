import { useEffect, useState } from 'react';
import type { RecoveryFile } from '@/data/recoverySchema';
import { studyDataApi, type StudyDataApi } from '@/services/data';
import { loadErrorMessage } from './loadErrorMessage';

export type RecoveryDataState =
  | { status: 'loading' }
  /** The group has no Landsat data yet (`npm run data:landsat` was not run for it). */
  | { status: 'absent' }
  | { status: 'ready'; data: RecoveryFile }
  | { status: 'error'; message: string };

/** React state over `StudyDataApi.loadRecovery` for one burn-scar group. */
export function useRecoveryData(
  groupId: string | null,
  api: StudyDataApi = studyDataApi,
  source: 'landsat' | 'appeears' = 'landsat',
): RecoveryDataState {
  const key = `${source}/${groupId}`;
  const [state, setState] = useState<{ id: string | null; value: RecoveryDataState }>({
    id: null,
    value: { status: 'loading' },
  });

  useEffect(() => {
    if (!groupId) return;
    const controller = new AbortController();
    api
      .loadRecovery(groupId, controller.signal, source)
      .then((data) => {
        if (!controller.signal.aborted)
          setState({ id: key, value: data ? { status: 'ready', data } : { status: 'absent' } });
      })
      .catch((e: unknown) => {
        if (!controller.signal.aborted) {
          setState({ id: key, value: { status: 'error', message: loadErrorMessage(e) } });
        }
      });
    return () => controller.abort();
  }, [api, groupId, source, key]);

  // A result for another group is stale: show loading until this one arrives.
  return state.id === key ? state.value : { status: 'loading' };
}
