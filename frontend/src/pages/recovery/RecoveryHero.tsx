import type { RefObject } from 'react';
import type { GroupRecovery } from '@/domain/study/recovery';
import { StudyStateView } from '@/components/shell/StudyStateView';
import type { StudyLoad } from '@/domain/study/studyView';
import type { RecoveryDataState } from '@/hooks/useRecoveryData';
import { Reveal } from '@/components/shell/Reveal';
import { GreennessFinding } from './GreennessFinding';
import { GroupFigures, GroupLede } from './GroupEvidence';

type HeadingRef = RefObject<HTMLHeadingElement | null>;

/**
 * Title and description of the selected group on the left; on the right, the
 * finding itself (what the satellite record shows), so the story comes before
 * the numbers. The measured figures follow as one line.
 */
export function RecoveryHero({
  r,
  referenceYear,
  landsatState,
  notFound,
  requestedId,
  headingRef,
}: {
  r: GroupRecovery;
  referenceYear: number;
  landsatState: RecoveryDataState;
  notFound: boolean;
  requestedId: string | null;
  headingRef: HeadingRef;
}) {
  return (
    <section
      aria-labelledby="recovery-title"
      data-band="ink"
      className="mb-10 grid gap-x-10 gap-y-8 pt-22 pb-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-end md:pt-22 md:pb-12"
    >
      <Reveal className="space-y-4">
        <p className="eyebrow text-muted-foreground!">
          Forest recovery · burn group {r.group.label}
        </p>
        <h1
          id="recovery-title"
          ref={headingRef}
          tabIndex={-1}
          className="display-title outline-none"
        >
          Burned in {r.group.fireYear}
        </h1>
        {notFound && (
          <p role="status" className="text-xs text-(--burn-text)">
            No burn-scar group “{requestedId}” in this dataset; showing the largest group instead.
          </p>
        )}
        <GroupLede r={r} referenceYear={referenceYear} />
        <GroupFigures r={r} referenceYear={referenceYear} />
      </Reveal>
      <Reveal delay={160}>
        <GreennessFinding state={landsatState} fireYear={r.group.fireYear} />
      </Reveal>
    </section>
  );
}

/** Before the study data exists: the page heading plus the shared loading / error view. */
export function RecoveryLoading({ load, headingRef }: { load: StudyLoad; headingRef: HeadingRef }) {
  return (
    <div className="max-w-[32rem] pt-28">
      <h1 ref={headingRef} tabIndex={-1} className="display-title mb-4 outline-none">
        Forest recovery
      </h1>
      <StudyStateView load={load} />
      {load.status === 'loading' && (
        <p className="text-sm text-muted-foreground">Loading the study data…</p>
      )}
    </div>
  );
}
