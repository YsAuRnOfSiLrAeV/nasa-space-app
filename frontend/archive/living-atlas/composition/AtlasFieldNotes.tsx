import type { ReactNode } from 'react';
import type { BurnGroup } from '@/components/study/burnGroups';
import { KeyFigures } from '@/components/study/KeyFigures';
import { SourcesList } from '@/components/study/SourcesList';
import { HeightDistribution } from '@/components/visualizations/HeightDistribution';
import { SignalEvidence } from '@/components/visualizations/SignalEvidence';
import { cn } from '@/lib/utils';
import type { StudyView } from '../types';
import { BurnRegister } from './BurnRegister';
import { ContourField } from './ContourField';
import styles from './LivingAtlas.module.css';

/** The moss card over a contour field: the study's headline figures. */
export function StudyAtAGlance({ study }: { study: StudyView }) {
  return (
    <section className={cn(styles.moss, 'relative shrink-0 overflow-hidden')}>
      <ContourField />
      <div className="relative px-4 pt-3.5 pb-4">
        <p className="eyebrow mb-3 text-(--muted-foreground)!">The study at a glance</p>
        <KeyFigures figures={study.figures} />
      </div>
    </section>
  );
}

/** Field notes 01–04: height, signals, the burn-scar register, sources. */
export function AtlasFieldNotes({
  study,
  focusId,
  onLocate,
}: {
  study: StudyView;
  focusId: string | null;
  onLocate: (group: BurnGroup) => void;
}) {
  return (
    <>
      <FieldNote index="01" title="Canopy height today">
        <HeightDistribution points={study.points} />
        <p className="prose-text mt-2 text-xs leading-relaxed">
          Heights measured by GEDI lidar: observations, not model predictions. Burnt-orange lines
          mark the 5 m and 10 m stage breaks.
        </p>
      </FieldNote>

      <FieldNote index="02" title="Which signal sees the forest">
        <SignalEvidence points={study.points} />
      </FieldNote>

      <FieldNote index="03" title="Burn-scar register">
        <BurnRegister groups={study.burnGroups} focusId={focusId} onLocate={onLocate} />
        <p className="prose-text mt-2.5 text-[11px] leading-relaxed italic">
          Groups of sampled points by fire year and 0.25° cell, not fire perimeters. Age is counted
          to the 2026 radar acquisitions.
        </p>
      </FieldNote>

      <FieldNote index="04" title="Sources and limits">
        <details>
          <summary className="cursor-pointer text-xs font-medium text-[#1f3a2b]">
            Datasets, credits and known limitations
          </summary>
          <SourcesList manifest={study.manifest} points={study.points} className="mt-3" />
        </details>
      </FieldNote>
    </>
  );
}

/** A numbered field-note card: "01 Canopy height today". */
function FieldNote({
  index,
  title,
  children,
}: {
  index: string;
  title: string;
  children: ReactNode;
}) {
  const id = `atlas-note-${index}`;
  return (
    <section aria-labelledby={id} className={styles.note}>
      <h2 id={id} className={styles.noteHeader}>
        <span className="text-muted-foreground">{index}</span> {title}
      </h2>
      <div className="p-3.5">{children}</div>
    </section>
  );
}

/** The panel's closing action: fly back to the whole study area. */
export function ReturnToStudyArea({ onReturn }: { onReturn: () => void }) {
  return (
    <div className={cn(styles.note, 'shrink-0 p-3.5')}>
      <button
        type="button"
        onClick={onReturn}
        className="w-full border border-[#1f3a2b] px-3 py-2 text-xs font-semibold tracking-[0.14em] text-[#1f3a2b] uppercase transition-colors duration-200 hover:bg-[#1f3a2b] hover:text-(--panel-bg)"
      >
        Return to the study area
      </button>
    </div>
  );
}
