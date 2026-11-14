import type { GroupRecovery } from '@/components/study/recovery';
import type { RecoveryDataState } from '@/hooks/useRecoveryData';
import { GrowthExplorer } from './growth/GrowthExplorer';
import { NumberedSection } from '@/components/shell/NumberedSection';
import { SectionNote } from './SectionNote';

/** The illustration view: clearly labelled, with the real observations beside it. */
export function GrowthView({
  r,
  landsatState,
  referenceYear,
}: {
  r: GroupRecovery;
  landsatState: RecoveryDataState;
  referenceYear: number;
}) {
  return (
    <NumberedSection
      n="01"
      title="Explore forest growth"
      meta="Illustration · not measured"
      className="mt-10 md:mt-12"
    >
      <SectionNote>
        An educational drawing of how a boreal stand like this one can regrow after fire, from the
        burn to year 30. It is not a prediction and not a picture of this site. Beside it, the real
        observations of this group for the matching calendar year.
      </SectionNote>
      <GrowthExplorer
        r={r}
        landsat={landsatState.status === 'ready' ? landsatState.data : null}
        referenceYear={referenceYear}
      />
    </NumberedSection>
  );
}
