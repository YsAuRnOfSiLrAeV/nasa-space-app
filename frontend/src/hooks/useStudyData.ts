import { studyDataApi, type StudyDataApi } from '@/services/data';
import { useResource } from './useResource';

export function useStudyData(api: StudyDataApi = studyDataApi) {
  return useResource('study', (signal) => api.loadStudy(signal));
}
