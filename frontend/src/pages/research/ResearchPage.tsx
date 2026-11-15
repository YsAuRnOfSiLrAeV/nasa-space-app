import { PageLayout } from '@/components/shell/PageLayout';
import type { StudyLoad, StudyView } from '@/domain/study/studyView';
import { AccuracyChapter } from './AccuracyChapter';
import { ForecastChapter } from './ForecastChapter';
import { GreenChapter } from './GreenChapter';
import { ReliabilityChapter } from './ReliabilityChapter';
import styles from './research.module.css';
import { ChapterBar, ResearchIntro } from './ResearchIntro';
import { StructureChapter } from './StructureChapter';
import { useState } from 'react';
import { SampleUnavailable, type ResearchSelection } from './ResearchStudy';
import { MethodologyGuide } from './MethodologyGuide';

/** The research page composes its chapters; each owns its evidence and supporting material. */
export function ResearchPage({ load, study }: { load: StudyLoad; study: StudyView | null }) {
  const [pickedId, onPick] = useState<string | null>(null);
  const selection: ResearchSelection = {
    group: study?.burnGroups.find((group) => group.id === pickedId) ?? study?.burnGroups[0] ?? null,
    onPick,
    sample: (render) => (study ? render(study) : <SampleUnavailable load={load} />),
  };
  return (
    <PageLayout section="research">
      <div className={styles.doc}>
        <ResearchIntro />
        <ChapterBar />
        <MethodologyGuide />
        <div>
          <div className="min-w-0">
            <GreenChapter {...selection} />
            <StructureChapter {...selection} />
            <AccuracyChapter sample={selection.sample} group={selection.group} />
            <ReliabilityChapter />
            <ForecastChapter />
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
