import { keepGreekCase } from '@/lib/text';
import { cn } from '@/lib/utils';
import type { StudyFigure } from '@/components/study/studyFigures';
import type { CompositionProps } from '../types';
import styles from './ResearchLab.module.css';

/** Desktop bottom bar: a tick ruler over the five readouts, or why there are none. */
export function ReadoutBar({ load, study }: Pick<CompositionProps, 'load' | 'study'>) {
  return (
    <footer
      data-map-occluder
      className="pointer-events-auto hidden shrink-0 border-t border-rule bg-background/92 md:block"
    >
      <div className={styles.ticks} aria-hidden />
      {study ? (
        <ReadoutGrid
          figures={study.figures}
          className="h-20 grid-cols-5 divide-x divide-rule [--figure-size:1.25rem] xl:[--figure-size:1.75rem]"
        />
      ) : (
        <div className={cn(styles.label, 'flex h-20 items-center px-5')}>
          {load.status === 'loading' ? 'Acquiring dataset…' : 'No readings: dataset unavailable'}
        </div>
      )}
    </footer>
  );
}

/** Large light numerals with micro labels (moodboard p01/p16 readout rows). */
export function ReadoutGrid({
  figures,
  className,
  wrap = false,
}: {
  figures: StudyFigure[];
  className?: string;
  /** Let long values wrap (narrow screens) instead of truncating. */
  wrap?: boolean;
}) {
  return (
    <dl className={cn('grid grid-cols-2', className)}>
      {figures.map((f) => (
        <div key={f.id} className="flex min-w-0 flex-col justify-center gap-1.5 px-5 py-3">
          <dt className={styles.label}>{keepGreekCase(f.label)}</dt>
          <dd className={cn('key-figure', wrap ? 'break-words' : 'truncate')}>
            {f.value}
            {f.unit && <span className={cn(styles.label, 'ml-2 align-middle')}>{f.unit}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}
