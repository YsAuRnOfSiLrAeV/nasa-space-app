import type { FireResult } from '@/data/fireSchema';
import styles from './Fire.module.css';

/** Show supplied dates and forecast milestones. No intermediate curve is invented. */
export function FireTimeline({ result }: { result: FireResult }) {
  const { fire, satellite_images: images, growth_forecast: forecast } = result;
  const milestones = [
    {
      date: String(fire.year),
      title: 'Fire year',
      detail: 'The start of this fire’s recovery timeline.',
    },
    ...(images.sentinel2
      ? [
          {
            date: images.sentinel2.from,
            title: 'Sentinel-2 optical observations',
            detail: `Observation window through ${images.sentinel2.to}.`,
          },
        ]
      : []),
    ...(images.sentinel1
      ? [
          {
            date: images.sentinel1.from,
            title: 'Sentinel-1 radar observations',
            detail: `${images.sentinel1.scenes} scenes through ${images.sentinel1.to}.`,
          },
        ]
      : []),
    ...(images.nisar
      ? [
          {
            date: images.nisar.date,
            title: 'NISAR radar observation',
            detail: 'The supplied L-band observation used by the model.',
          },
        ]
      : []),
  ].sort((a, b) => a.date.localeCompare(b.date));
  milestones.push({
    date: String(images.summer),
    title: `Summer ${images.summer} ${result.warnings.includes('MOCK_RESULT') ? 'mock state' : 'model state'}`,
    detail: result.warnings.includes('MOCK_RESULT')
      ? 'An illustrative grid generated locally to demonstrate the interface.'
      : 'The recovery map shows the state estimated from this summer’s imagery.',
  });
  const milestoneYear = forecast?.year_80pct;
  const outsideRange =
    forecast &&
    milestoneYear != null &&
    (milestoneYear - fire.year < forecast.reliable_age[0] ||
      milestoneYear - fire.year > forecast.reliable_age[1]);
  return (
    <section aria-labelledby="fire-timeline-title">
      <h2 id="fire-timeline-title" className={styles.sectionTitle}>
        From fire to recovery
      </h2>
      <ol className={styles.timeline}>
        {milestones.map((milestone) => (
          <li key={milestone.title}>
            <time dateTime={milestone.date}>{milestone.date}</time>
            <div>
              <h3>{milestone.title}</h3>
              <p>{milestone.detail}</p>
            </div>
          </li>
        ))}
        {milestoneYear != null && (
          <li>
            <time dateTime={String(milestoneYear)}>{milestoneYear}</time>
            <div>
              <h3>80% structural recovery · forecast</h3>
              <p>
                Milestone supplied by the growth model.
                {outsideRange &&
                  ' This age lies outside the validated range and is an extrapolation.'}
              </p>
            </div>
          </li>
        )}
      </ol>
      {forecast ? (
        <div className={styles.notice}>
          <p>
            The supplied forecast uses {forecast.method.replaceAll('_', ' ')}. Its validated
            fire-age range is {forecast.reliable_age[0]}–{forecast.reliable_age[1]} years. A
            forecast uncertainty interval has not been supplied.
          </p>
          <p className="mt-2">
            The year explorer above provides a separately labelled forward-growth preview from the
            supplied {images.summer} state. Its equation needs scientific confirmation.
          </p>
        </div>
      ) : (
        <p className={styles.notice}>A growth forecast has not been supplied for this fire.</p>
      )}
    </section>
  );
}
