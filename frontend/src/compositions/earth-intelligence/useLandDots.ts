import { useResource, type Resource } from '@/hooks/useResource';
import { studyDataApi, type StudyDataApi, type LandMask } from '@/services/data';

export type LandDots = Resource<LandMask>;
export function useLandDots(api: StudyDataApi = studyDataApi, enabled = true) {
  return useResource(enabled ? 'land-dots' : null, (signal) => api.loadLandMask(signal));
}
