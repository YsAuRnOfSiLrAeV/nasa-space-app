import { formatLonLat } from '@/components/map/graticule';
import { FigureRow } from '@/components/shell/FigureRow';
import type { GroupRecovery } from '@/components/study/recovery';
import styles from './Recovery.module.css';

/** Measured statistics of the selected group, as one line. */
export function GroupFigures({ r, referenceYear }: { r: GroupRecovery; referenceYear: number }) {
  return (
    <FigureRow
      figures={[
        { id: 'points', value: `${r.group.count}`, label: 'sample points' },
        { id: 'height', value: `${r.group.medianHeightM.toFixed(1)} m`, label: 'median canopy' },
        {
          id: 'tall',
          value: `${Math.round(r.group.shareTall * 100)}%`,
          label: 'at least 10 m tall',
        },
        {
          id: 'age',
          value: `${r.group.ageYears}`,
          label: `years since the fire (to ${referenceYear})`,
        },
      ]}
    />
  );
}

/** One-paragraph description of the group, every number from the data. */
export function GroupLede({ r, referenceYear }: { r: GroupRecovery; referenceYear: number }) {
  const [a0, a1] = r.ageAtGedi;
  return (
    <p className="max-w-[36rem] text-[15px] leading-relaxed text-muted-foreground">
      {r.group.count} GEDI lidar footprints around{' '}
      <span className="type-coord text-foreground">{formatLonLat(r.group.centroid)}</span>, burned
      in {r.group.fireYear}. Their canopy heights were measured {a0 === a1 ? a0 : `${a0}–${a1}`}{' '}
      years after the fire ({r.gediYears.join(', ')}); the radar was acquired {r.group.ageYears}{' '}
      years after it, in {referenceYear}. A group of sampled points in one 0.25° cell, not a fire
      perimeter.
    </p>
  );
}

/** Pre-fire land cover (MODIS 2001 classes) and Hansen 2000 tree cover. */
export function PreFireCover({ r }: { r: GroupRecovery }) {
  const total = r.points.length;
  return (
    <div className="space-y-4">
      <ul className="space-y-3">
        {r.preFireClasses.map((c) => (
          <li key={c.code}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-xs">
              <span className="text-foreground">{c.label}</span>
              <span className="font-mono text-muted-foreground tabular-nums">
                {c.n} of {total}
              </span>
            </div>
            <div className={styles.bar} aria-hidden>
              <span style={{ width: `${(c.n / total) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
      <p className="text-xs text-foreground">
        Tree cover in 2000: <span className="font-mono">{r.treeCover2000Pct}%</span>{' '}
        <span className="text-muted-foreground">(median, Hansen Global Forest Change)</span>
      </p>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        MODIS MCD12Q1 gives one land-cover class per 500 m pixel for 2001. It describes the kind of
        cover, not which tree species grew here.
      </p>
    </div>
  );
}
