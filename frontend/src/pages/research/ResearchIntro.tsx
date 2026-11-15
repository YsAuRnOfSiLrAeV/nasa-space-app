import { FOREST_3D_HREF } from '@/app/route';
import { PageIntro } from '@/components/shell/PageLayout';
import { DEMO_FIRE_COMPARISON } from '@/data/calibrationEvidence';
import { Prose } from './Prose';
import { ResearchContents, type ContentsEntry } from './ResearchContents';
import { CHAPTER_LIST, INTRO } from './chapters';
import { HeadlineComparison } from './figures/RecoveryComparisonChart';
import styles from './research.module.css';

const CONTENTS: ContentsEntry[] = [
  { id: 'methodology-guide', n: 'i', title: 'Methodology guide' },
  ...CHAPTER_LIST.map((c) => ({ id: c.id, n: c.n, title: c.short })),
];
export function ResearchIntro() {
  const headline = DEMO_FIRE_COMPARISON.find((r) => r.fire === INTRO.headlineFire);
  return (
    <PageIntro eyebrow={INTRO.eyebrow} title={INTRO.title}>
      <div className={styles.heroText}>
        <Prose>{INTRO.lede}</Prose>
        <a href={FOREST_3D_HREF} className={styles.cta}>
          <span>
            <b>Forest structure in 3D</b>
            <small>Conceptual illustration · orbit and zoom</small>
          </span>
          <span aria-hidden>→</span>
        </a>
      </div>
      {headline && <HeadlineComparison row={headline} note={INTRO.headlineNote} />}
    </PageIntro>
  );
}

export function ChapterBar() {
  return (
    <div data-band="ink" className={styles.chapterBar}>
      <ResearchContents entries={CONTENTS} label="Chapters" />
    </div>
  );
}
