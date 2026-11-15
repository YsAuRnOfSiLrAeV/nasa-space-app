import { cn } from '@/lib/utils';
import { ThemeSwitcher } from '@/components/theme/ThemeSwitcher';
import type { CompositionProps } from '../types';
import styles from './ResearchLab.module.css';

/** The instrument's top rail: title, dataset status lamp and the theme switcher. */
export function TopRail({ load, study }: Pick<CompositionProps, 'load' | 'study'>) {
  return (
    <header
      data-map-occluder
      className="pointer-events-auto flex h-14 shrink-0 items-center gap-5 border-b border-rule bg-background/92 px-4"
    >
      <div className="flex min-w-0 items-baseline gap-3">
        <h1 className="display-title whitespace-nowrap max-sm:text-[0.6875rem] max-sm:tracking-[0.1em]">
          The Forest Remembers
        </h1>
        <span className={cn(styles.label, 'hidden whitespace-nowrap 2xl:inline')}>
          / Research Lab · Post-fire forest recovery
        </span>
      </div>
      <DatasetStatus load={load} study={study} />
      <div className="ml-auto xl:ml-0">
        <ThemeSwitcher variant="inline" />
      </div>
    </header>
  );
}

/** Lit lamp plus product and acquisition dates once loaded; an idle lamp until then. */
function DatasetStatus({ load, study }: Pick<CompositionProps, 'load' | 'study'>) {
  const dates = study?.manifest.nisar_dates ?? [];
  return (
    <div
      className={cn(styles.label, 'ml-auto hidden items-center gap-4 whitespace-nowrap xl:flex')}
      role="status"
      aria-live="polite"
    >
      {study ? (
        <>
          <span className="flex items-center gap-2 text-foreground">
            <span className={styles.lamp} aria-hidden />
            Data loaded
          </span>
          <span>NISAR L2 GCOV</span>
          <span>
            Acq {dates[0]}
            {dates.length > 1 && ` → ${dates[dates.length - 1]}`}
          </span>
        </>
      ) : (
        <span className="flex items-center gap-2">
          <span className={styles.lampIdle} aria-hidden />
          {load.status === 'loading' ? 'Loading dataset' : 'Dataset unavailable'}
        </span>
      )}
    </div>
  );
}
