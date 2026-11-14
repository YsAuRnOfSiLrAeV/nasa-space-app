import type { RecoveryView } from '@/app/route';
import type { StudyLoad, StudyView } from '@/components/study/studyView';
import { GrowthView } from './GrowthView';
import { ObservedRecovery } from './ObservedRecovery';
import { RecoveryHero, RecoveryLoading } from './RecoveryHero';
import { RecoveryLayout } from './RecoveryLayout';
import { GroupPicker, ViewTabs } from './RecoveryNav';
import { useRecoveryGroup } from './useRecoveryGroup';

/**
 * Forest Recovery: the evidence for one burn-scar group (observed view) and a
 * clearly separate illustration of regrowth (growth view).
 */
export function RecoveryPage({
  load,
  study,
  groupId,
  view,
}: {
  load: StudyLoad;
  study: StudyView | null;
  groupId: string | null;
  view: RecoveryView;
}) {
  const { r, notFound, landsatState, scrollRef, headingRef } = useRecoveryGroup(study, groupId);

  return (
    <RecoveryLayout scrollRef={scrollRef}>
      {!study || !r ? (
        <RecoveryLoading load={load} headingRef={headingRef} />
      ) : (
        <>
          <RecoveryHero
            r={r}
            referenceYear={study.manifest.reference_year}
            landsatState={landsatState}
            notFound={notFound}
            requestedId={groupId}
            headingRef={headingRef}
          />
          <GroupPicker groups={study.burnGroups} currentId={r.group.id} view={view} />
          <ViewTabs groupId={r.group.id} view={view} />
          {view === 'growth' ? (
            <GrowthView
              r={r}
              landsatState={landsatState}
              referenceYear={study.manifest.reference_year}
            />
          ) : (
            <ObservedRecovery r={r} study={study} landsatState={landsatState} />
          )}
        </>
      )}
    </RecoveryLayout>
  );
}
