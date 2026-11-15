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
              Provider-supplied geographic regions: verified areas use solid outlines and stronger
              fill; extrapolated areas use dashed outlines and lighter fill. Model-1 state, model-2
              growth and model-2 scenario regions are separate classifications. Outside them, no
              applicability claim is made. These are not probabilities or burn/reference masks.
            </p>
          </div>
          <div>
            <h3 className={styles.minorHead}>Relative score · p_forest_gt5</h3>
            <p>
              The model’s output for forest above 5 m is a 0–1 ranking score. Legacy category views
              use three bands on a 0–100 display scale: {SCORE_BANDS.labels.join(' / ')} (below{' '}
              {SCORE_BANDS.breaks[0]}, {SCORE_BANDS.breaks[0]}–{SCORE_BANDS.breaks[1]},{' '}
              {SCORE_BANDS.breaks[1]} and over on the display scale). {SCORE_BANDS.status}. The
              real-data Explorer also shows the original continuous score; it remains uncalibrated.
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
