import { studyDataApi } from '@/services/data';
import type { DemoFire } from '@/data/fireSchema';
import { useResource } from './useResource';

export const EMPTY_FIRES: DemoFire[] = [];
export function useFireCatalog() {
  return useResource('fire-catalog', (signal) => studyDataApi.loadFireIndex(signal));
}
export type FireCatalog = ReturnType<typeof useFireCatalog>;
