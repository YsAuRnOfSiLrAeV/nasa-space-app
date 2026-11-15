import { Reveal } from '@/components/shell/Reveal';
import { HEIGHT_ACCURACY } from '@/data/calibrationEvidence';
import { Chapter, Supporting } from './ChapterFrame';
import { CHAPTERS } from './chapters';
import { HeightAccuracyChart } from './figures/HeightAccuracyChart';
import styles from './research.module.css';

import { HeightStages, type ResearchSelection } from './ResearchStudy';

export function AccuracyChapter({ sample, group }: Pick<ResearchSelection, 'sample' | 'group'>) {
  return (
    <Reveal>
      <Chapter copy={CHAPTERS.accuracy} figure={<HeightAccuracyChart accuracy={HEIGHT_ACCURACY} />}>
        <div className={styles.statement}>
          <h3 className={styles.minorHead}>Why cells show stages and fires show numbers</h3>
          <p>
            One cell’s height would carry about ±{HEIGHT_ACCURACY.point.maeM.toFixed(1)} m of noise,
            so the map shows each cell only as a category. Metres and recovery percentages are
            reported for the whole fire, where the error falls to{' '}
            {HEIGHT_ACCURACY.fire.maeM.toFixed(1)} m.
          </p>
        </div>
        <Supporting
          defer={group !== null}
          summary="GEDI height distribution and the stage breaks"
          note="Reference measurements · Ontario study sample"
        >
          {sample((s) => (
            <HeightStages study={s} />
          ))}
        </Supporting>
      </Chapter>
    </Reveal>
  );
}
