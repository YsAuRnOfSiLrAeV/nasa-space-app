import { useEffect, useState } from 'react';
import { loadErrorMessage } from '@/hooks/loadErrorMessage';
import { studyDataApi, type StudyDataApi } from '@/services/data';

export type LandDots =
  | { status: 'loading' }
  | { status: 'ready'; dots: [number, number][]; source: string }
  | { status: 'error'; message: string };

/**
 * React state over `StudyDataApi.loadLandMask` (public/data/land-dots.json,
 * built from Natural Earth by `npm run data:globe`). Fetched only by this theme.
 */
export function useLandDots(api: StudyDataApi = studyDataApi): LandDots {
  const [state, setState] = useState<LandDots>({ status: 'loading' });
  useEffect(() => {
    const controller = new AbortController();
    api
      .loadLandMask(controller.signal)
      .then((mask) => setState({ status: 'ready', ...mask }))
      .catch((e: unknown) => {
        if (!controller.signal.aborted) setState({ status: 'error', message: loadErrorMessage(e) });
      });
    return () => controller.abort();
  }, [api]);
  return state;
}
