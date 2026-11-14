import { cn } from '@/lib/utils';
import { TIMELINE_START, type TimelineLane } from '@/components/study/recovery';

/** Lanes with more markers than this rely on the year axis instead of per-marker labels. */
const MAX_MARKER_LABELS = 6;
import ui from '@/components/shell/primitives.module.css';
import styles from './Recovery.module.css';

/**
 * One row per data source, markers only in years with an actual observation.
 * The dotted line between markers is a gap, not an interpolation.
 */
export function ObservationTimeline({
  lanes,
  fireYear,
  endYear,
}: {
  lanes: TimelineLane[];
  fireYear: number;
  endYear: number;
}) {
  const pos = (year: number) => `${((year + 0.5 - start) / (endYear + 1 - start)) * 100}%`;
  // Starts at the earliest observation (Landsat can reach back before 2000).
  const start = Math.min(TIMELINE_START, ...lanes.flatMap((l) => l.events.map((e) => e.year)));
  const ticks = [
    ...Array.from({ length: 6 }, (_, i) => Math.ceil(start / 5) * 5 + i * 5).filter(
      (y) => y < endYear - 2,
    ),
    endYear,
  ];
  return (
    <div>
      <div aria-hidden className="relative">
        {/* Year axis */}
        <div className={styles.lane} style={{ borderTop: 0, minHeight: '1.5rem' }}>
          <span />
          <div className="relative h-6">
            {ticks.map((y) => (
              <span
                key={y}
                className={cn(
                  ui.micro,
                  'type-coord absolute top-1 -translate-x-1/2 tracking-[0.06em]',
                )}
                style={{ left: pos(y) }}
              >
                {y}
              </span>
            ))}
          </div>
        </div>
        {lanes.map((lane) => (
          <div key={lane.id} className={styles.lane}>
            <div className="min-w-0 py-1.5">
              <div className="truncate text-xs text-foreground">{lane.label}</div>
              <div className={cn(ui.micro, 'text-[9px] leading-snug')}>{lane.source}</div>
            </div>
            <div className={styles.track}>
              <span className={styles.afterFire} style={{ left: pos(fireYear) }} />
              <span className={styles.fireRule} style={{ left: pos(fireYear) }} />
              {lane.events.length === 0 && lane.empty && (
                <span
                  className={cn(
                    ui.micro,
                    'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 text-[9px] whitespace-nowrap',
                  )}
                >
                  {lane.empty}
                </span>
              )}
              {lane.events.map((e, i) => (
                <span key={`${e.year}-${i}`} title={`${e.year}: ${e.label}`}>
                  <span
                    className={cn(styles.marker, lane.id === 'fire' && styles.markerFire)}
                    style={{ left: pos(e.year) }}
                  />
                  {/* Adjacent GEDI years: first and last only; dense lanes: the axis is enough. */}
                  {lane.events.length <= MAX_MARKER_LABELS &&
                    (lane.id !== 'gedi' || i === 0 || i === lane.events.length - 1) && (
                      <span
                        className={cn(styles.markerLabel, 'max-sm:hidden')}
                        style={{ left: pos(e.year) }}
                      >
                        {e.year}
                      </span>
                    )}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* The same content as text: for screen readers, and readable on phones. */}
      <details className="mt-4">
        <summary className={cn(ui.micro, 'cursor-pointer')}>Timeline as a list</summary>
        <ul className="mt-3 space-y-2 text-xs leading-relaxed">
          {lanes.map((lane) => (
            <li key={lane.id}>
              <span className="text-foreground">{lane.label}</span>{' '}
              <span className="text-muted-foreground">({lane.source})</span>:{' '}
              {lane.events.length
                ? lane.events.map((e) => `${e.year}, ${e.label}`).join('; ')
                : (lane.empty ?? 'none')}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
