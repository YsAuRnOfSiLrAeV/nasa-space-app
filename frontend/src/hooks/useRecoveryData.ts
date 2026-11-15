import type { RecoveryFile } from '@/data/recoverySchema';
import { studyDataApi, type StudyDataApi } from '@/services/data';
import { useResource, type Resource } from './useResource';

export type RecoveryDataState = Resource<RecoveryFile>;
export function useRecoveryData(
  groupId: string | null,
  api: StudyDataApi = studyDataApi,
  source: 'landsat' | 'appeears' = 'landsat',
) {
  return useResource(groupId ? `${source}/${groupId}` : null, (signal) =>
    api.loadRecovery(groupId!, signal, source),
  );
}
