import { cn } from '@/lib/utils';
import { formatLat, formatLon } from '@/components/map/graticule';
import type { StudyView } from '../types';
import styles from './LivingAtlas.module.css';

/** The title block set on the map: eyebrow, title, summary and study extent. */
export function AtlasTitle({ study }: { study: StudyView | null }) {
  const bbox = study?.manifest.bbox;
  return (
    <header
      data-map-occluder="top"
      className={cn(
        styles.titleFade,
        'pointer-events-none absolute top-0 left-0 z-10 max-w-[44rem] px-6 pt-6 pb-10 md:px-8 md:pt-7',
      )}
    >
      <p className="eyebrow">An atlas of fire and forest recovery · Northwestern Ontario</p>
      <h1 className={cn(styles.title, 'mt-2')}>The Forest Remembers</h1>
      <p className="prose-text mt-3 max-w-[30rem] text-sm leading-relaxed text-[#3d4a38]">
        {study ? `${study.manifest.counts.points} lidar footprints` : 'Lidar footprints'} across
        burned and unburned boreal forest, read against NISAR L-band radar.
      </p>
      {bbox && (
        <p className="type-coord mt-2.5 text-[10.5px] tracking-[0.04em] text-[#66705f]">
          {formatLat(bbox[1], 0.01)}–{formatLat(bbox[3], 0.01)} · {formatLon(bbox[0], 0.01)}–
          {formatLon(bbox[2], 0.01)}
        </p>
      )}
    </header>
  );
}
