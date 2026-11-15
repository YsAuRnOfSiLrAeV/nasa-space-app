import { Reveal } from '@/components/shell/Reveal';
import { DEMO_FIRE_COMPARISON, OPTICAL_RULE } from '@/data/calibrationEvidence';
import { Chapter, Supporting } from './ChapterFrame';
import { ObservedRecoverySection } from './ObservedRecoverySection';
import { Prose } from './Prose';
import { CHAPTERS } from './chapters';
import {
  RecoveryComparisonChart,
  RecoveryComparisonTable,
} from './figures/RecoveryComparisonChart';

import type { ResearchSelection } from './ResearchStudy';

export function GreenChapter({ sample, group, onPick }: ResearchSelection) {
  return (
    <Reveal>
      <Chapter
        copy={CHAPTERS.green}
        figure={
          <RecoveryComparisonChart
            rows={DEMO_FIRE_COMPARISON}
            notes={{ 'Quebec 2010': 'the model is also far above GEDI here' }}
          />
        }
      >
        <Supporting summary="Data table and the optical rule" note="Calibration study">
          <RecoveryComparisonTable rows={DEMO_FIRE_COMPARISON} />
          <Prose>
            Optical proxy rule: {OPTICAL_RULE.rule}. {OPTICAL_RULE.status}. A suggested alternative:{' '}
            {OPTICAL_RULE.alternative.toLowerCase()}. Across fires, NDVI correlates with GEDI height
            at {OPTICAL_RULE.ndviGediCorrelation.toFixed(2)}, which the report flags as worth
            investigating, not as an explained result.
          </Prose>
        </Supporting>
        <Supporting
          defer={group !== null}
          summary="Optical history of one Ontario sampling group"
          note="Observations · Ontario study sample, not the calibration study"
        >
          {sample((s) =>
            group ? (
              <ObservedRecoverySection study={s} group={group} onPick={onPick} />
            ) : (
              <Prose>No sampling groups are available in the loaded study data.</Prose>
            ),
          )}
        </Supporting>
      </Chapter>
    </Reveal>
  );
}
