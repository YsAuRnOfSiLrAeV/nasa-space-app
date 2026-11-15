import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { Manifest, Stage } from '@/data/schema';
import { formatYearRange, gediYearRange, type YearRange } from '@/data/sources';
import { HeightDistribution } from '@/components/visualizations/HeightDistribution';
import { STAGE_BG, STAGE_LABELS } from '@/styles/tokens';
import type { StudyView } from '../types';
import styles from './ResearchLab.module.css';

const STAGES: Stage[] = [0, 1, 2];
type Counts = Manifest['counts'];

/** Module A: measured distribution, stage counts, the symbol key and its provenance. */
export function HeightScale({ study }: { study: StudyView }) {
  const years = useMemo(() => gediYearRange(study.points), [study.points]);
  return (
    <div className="space-y-3">
      <HeightDistribution points={study.points} />
      <StageCountTable counts={study.manifest.counts} />
      <PointSymbolKey counts={study.manifest.counts} />
      <LidarProvenanceNote years={years} />
    </div>
  );
}

/** Points per canopy-height stage, with each stage's share of the total. */
function StageCountTable({ counts }: { counts: Counts }) {
  const share = (n: number) => (counts.points ? ((n / counts.points) * 100).toFixed(1) : '0.0');
  return (
    <table className="w-full font-mono text-[10px] tabular-nums">
      <caption className="sr-only">Points per forest-height stage (lidar observation)</caption>
      <thead>
        <tr className={styles.label}>
          <th className="py-1 text-left font-medium">Stage</th>
          <th className="py-1 text-right font-medium">n</th>
          <th className="py-1 text-right font-medium">%</th>
        </tr>
      </thead>
      <tbody>
        {STAGES.map((s) => (
          <tr key={s} className="border-t border-rule">
            <td className="py-1.5">
              <span className="flex items-center gap-2">
                <span aria-hidden className={cn('inline-block h-2 w-3', STAGE_BG[s])} />
                {STAGE_LABELS[s]}
              </span>
            </td>
            <td className="py-1.5 text-right">{counts.by_lidar_stage[s]}</td>
            <td className="py-1.5 text-right text-muted-foreground">
              {share(counts.by_lidar_stage[s])}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Filled dot = burned, ring = unburned reference, as drawn on the map. */
function PointSymbolKey({ counts }: { counts: Counts }) {
  return (
    <div className={cn(styles.label, 'flex flex-wrap gap-x-4 gap-y-1.5')}>
      <span className="flex items-center gap-1.5">
        <span aria-hidden className="inline-block size-2 rounded-full bg-muted-foreground" />
        Burned 2001–2012 · {counts.burned}
      </span>
      <span className="flex items-center gap-1.5">
        <span
          aria-hidden
          className="inline-block size-2 rounded-full border border-muted-foreground"
        />
        Unburned ref · {counts.unburned}
      </span>
    </div>
  );
}

/** States that heights are lidar observations, and when they were taken. */
function LidarProvenanceNote({ years }: { years: YearRange | null }) {
  return (
    <p className="font-[family-name:var(--font-prose)] text-[11px] leading-relaxed text-muted-foreground">
      Observed by lidar{years && ` (${formatYearRange(years)})`}. This is reference data, not a
      model prediction. Dashed lines mark the 5 m and 10 m stage breaks.
    </p>
  );
}
