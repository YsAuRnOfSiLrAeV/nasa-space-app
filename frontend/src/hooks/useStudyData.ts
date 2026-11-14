import { useCallback, useEffect, useState } from 'react';
import { studyDataApi, type StudyData, type StudyDataApi } from '../services/data';
import { loadErrorMessage } from './loadErrorMessage';

export type StudyDataState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: StudyData };

/** React state over `StudyDataApi.loadStudy`, with a retry that refetches. */
export function useStudyData(
  api: StudyDataApi = studyDataApi,
): StudyDataState & { retry: () => void } {
  const [state, setState] = useState<StudyDataState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    api
      .loadStudy(controller.signal)
      .then((data) => setState({ status: 'ready', data }))
      .catch((e: unknown) => {
        if (!controller.signal.aborted) setState({ status: 'error', message: loadErrorMessage(e) });
      });
    return () => controller.abort();
  }, [api, attempt]);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  return { ...state, retry };
}
