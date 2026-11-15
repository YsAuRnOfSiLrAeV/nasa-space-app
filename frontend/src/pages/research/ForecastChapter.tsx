import { fireHref } from '@/app/route';
import { Reveal } from '@/components/shell/Reveal';
import { FORECAST_VALIDATION } from '@/data/calibrationEvidence';
import recovery from '@/pages/recovery/Recovery.module.css';
import { Chapter } from './ChapterFrame';
import { Prose } from './Prose';
import { CHAPTERS } from './chapters';
import { ForecastValidationChart, ProvisionalCurve } from './figures/ForecastValidationChart';

export function ForecastChapter() {
  return (
    <Reveal>
      <Chapter
        copy={CHAPTERS.forecast}
        figure={<ForecastValidationChart validation={FORECAST_VALIDATION} />}
      >
        <ProvisionalCurve />
        <Prose>
          The example fire{' '}
          <a href={fireHref('bc_2003_490')} className={recovery.link}>
            British Columbia 2003
          </a>{' '}
          on the map draws its supplied model2.series and uncertainty, with its current modeled
          estimate marked separately. Its forecast-year slider is independent of the spatial cell
          timeline. It does not turn either output into a new observation.
        </Prose>
      </Chapter>
    </Reveal>
  );
}
