import { studyDataApi } from '@/services/data';
import type { DemoFire } from '@/data/fireSchema';
import { shownFires } from '@/data/visibleFires';
import { useResource } from './useResource';

export const EMPTY_FIRES: DemoFire[] = [];
export function useFireCatalog() {
  return useResource('fire-catalog', (signal) =>
    studyDataApi.loadFireIndex(signal).then(shownFires),
  );
}
export type FireCatalog = ReturnType<typeof useFireCatalog>;
