import type { ApplicabilityZones } from '@/data/applicabilityZones';
import { studyDataApi } from '@/services/data';
import { useResource } from './useResource';

export function useApplicabilityZones(enabled: boolean) {
  return useResource<ApplicabilityZones>(enabled ? 'supplied-applicability' : null, (signal) =>
    studyDataApi.loadApplicabilityZones(signal),
  );
}
export type ApplicabilityResource = ReturnType<typeof useApplicabilityZones>;
