import { Reveal } from '@/components/shell/Reveal';
import { LIMITATIONS, SCORE_BANDS, SCORE_CALIBRATION } from '@/data/calibrationEvidence';
import { Chapter, Supporting } from './ChapterFrame';
import { CHAPTERS } from './chapters';
import { ScoreCalibrationChart } from './figures/ScoreCalibrationChart';
import styles from './research.module.css';

export function ReliabilityChapter() {
  return (
    <Reveal>
      <Chapter
        copy={CHAPTERS.reliability}
        band="ink"
        figure={<ScoreCalibrationChart rows={SCORE_CALIBRATION} />}
      >
        <div className={styles.twoConcepts}>
          <div>
            <h3 className={styles.minorHead}>Geographic applicability zones</h3>
            <p>
              A pipeline classification of place: inside the model’s region, state only, or outside
              it. Not a probability. On the map, outside cells are grey.
            </p>
          </div>
          <div>
            <h3 className={styles.minorHead}>Relative score · p_forest_gt5</h3>
            <p>
              The model’s output for forest above 5 m, shown in three bands:{' '}
              {SCORE_BANDS.labels.join(' / ')} (below {SCORE_BANDS.breaks[0]},{' '}
              {SCORE_BANDS.breaks[0]}–{SCORE_BANDS.breaks[1]}, {SCORE_BANDS.breaks[1]} and over on
              the raw score). {SCORE_BANDS.status}.
            </p>
          </div>
        </div>
        <Supporting summary="Known limitations of inputs and references" note="As reported">
          <dl className={styles.limits}>
            {LIMITATIONS.map((l) => (
              <div key={l.title}>
                <dt>{l.title}</dt>
                <dd>{l.detail}</dd>
              </div>
            ))}
          </dl>
        </Supporting>
      </Chapter>
    </Reveal>
  );
}
