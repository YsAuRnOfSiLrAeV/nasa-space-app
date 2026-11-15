import type { Ref } from 'react';
import type { StudyView } from '@/domain/study/studyView';
import { formatAcquisitionDates, regionPlot } from './readouts';
import cartography from './ScientificLanding.module.css';

/** NISAR HV samples at their supplied coordinates, not a continuous radar image. */
export function ObservationWindow({
  study,
  frameRef,
  className,
}: {
  study: StudyView;
  frameRef: Ref<HTMLDivElement>;
  className?: string;
}) {
  const samples = study.located.filter((point) => Number.isFinite(point.nisar_hv_db));
  if (!samples.length) return null;

  const values = samples.map((point) => point.nisar_hv_db);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const dates = [
    ...new Set(samples.flatMap((point) => (point.nisar_date ? [point.nisar_date] : []))),
  ];
  const { at, height } = regionPlot(study.manifest.bbox, 240);
  const site = study.manifest.sites.join(', ');

  return (
    <figure className={className}>
      <div className={cartography.panelLabel}>
        <span className={cartography.figureIndex}>NISAR · L-band radar</span>
      </div>
      <div
        ref={frameRef}
        className={cartography.windowFrame}
        style={{ aspectRatio: `252 / ${height + 12}` }}
      >
        <svg
          viewBox={`-6 -6 252 ${height + 12}`}
          className={cartography.radarSamples}
          role="img"
          aria-label={`NISAR HV backscatter at ${samples.length} sampled locations${site ? ` in ${site}` : ''}. North is up. Brighter points indicate stronger backscatter, from ${low.toFixed(1)} to ${high.toFixed(1)} dB. Samples only, not a continuous radar image or a canopy-height map.`}
        >
          {samples.map((point) => {
            const { x, y } = at(point.lon, point.lat);
            const strength = high === low ? 1 : (point.nisar_hv_db - low) / (high - low);
            return (
              <circle key={point.point_id} cx={x} cy={y} r={2} opacity={0.35 + strength * 0.65}>
                <title>{`${point.nisar_hv_db.toFixed(3)} dB · ${point.nisar_date ?? 'Date unavailable'}`}</title>
              </circle>
            );
          })}
        </svg>
      </div>
      <figcaption className={cartography.panelCaption}>
        <span>{samples.length} HV samples · dB</span>
        <span className={cartography.signalRange}>
          <span>{low.toFixed(1)} (dimmer)</span>
          <span>{high.toFixed(1)} (brighter)</span>
        </span>
        <span>{formatAcquisitionDates(dates) ?? 'Acquisition dates unavailable'}</span>
      </figcaption>
    </figure>
  );
}
