import { useResource } from '@/hooks/useResource';
import { studyDataApi } from '@/services/data';

export type OpticalStatus = 'none' | 'loading' | 'ready' | 'missing';

/**
 * `optical.png` is optional. It is checked before it reaches the map, so a missing
 * or broken file becomes a labelled state instead of a map error.
 */
export function useOpticalImage(url: string | null): OpticalStatus {
  const { state } = useResource(url, (signal) => studyDataApi.imageLoads(url!, signal));
  if (state.status === 'idle') return 'none';
  if (state.status === 'loading') return 'loading';
  return state.status === 'ready' && state.data ? 'ready' : 'missing';
}
