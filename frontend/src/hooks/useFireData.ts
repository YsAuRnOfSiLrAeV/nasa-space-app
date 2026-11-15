import type { FireData } from '@/data/fireSchema';
import { studyDataApi } from '@/services/data';
import { useResource, type Resource } from './useResource';

export type FireState = Resource<FireData>;

/**
 * One fire's result and cells (null: no fire selected). The service keeps loaded
 * fires for the visit, so returning to one shows it at once; retry asks for a fresh copy.
 */
export function useFireData(fireId: string | null) {
  return useResource(
    fireId,
    (signal, fresh) => studyDataApi.loadFire(fireId!, signal, { fresh }),
    (id) => studyDataApi.cachedFire(id),
  );
}
