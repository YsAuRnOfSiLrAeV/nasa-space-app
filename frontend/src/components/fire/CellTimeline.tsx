import { useEffect, useId, useRef, useState } from 'react';
import type { FireTimeline } from '@/data/fireTypes';
import {
  nearestTimelineYear,
  stepTimelineYear,
  timelineYearKind,
} from '@/domain/fire/cellTimeline';
import { usePrefersReducedMotion } from '@/hooks/useMediaQuery';
import styles from './CellTimeline.module.css';

const KIND = {
  before: 'Modeled back from the observation summer',
  summer: 'Modeled state at the observation summer',
  after: 'Modeled projection',
} as const;

/**
 * Recovery through time: switches the map to the fire's modeled cell recovery and
 * chooses the year. The years are the ones the fire's timeline supplies. Every year
 * is a model estimate, the past ones included, and the control says so.
 *
 * `year` is null while the timeline is off. Separate from the whole-fire forecast.
 */
export function CellTimelineControls({
  timeline,
  year,
  summer,
  onYear,
}: {
  timeline: Pick<FireTimeline, 'years' | 'recovery_pct'>;
  year: number | null;
  /** The observation summer the model projects from. */
  summer: number;
  onYear: (year: number | null) => void;
}) {
  const id = useId();
  const reduced = usePrefersReducedMotion();
  const [playing, setPlaying] = useState(false);
  const years = timeline.years;
  const first = years[0]!;
  const last = years.at(-1)!;
  const shown = year === null ? null : nearestTimelineYear(timeline, year);
  const active = playing && shown !== null;

  // The timer reads the latest year without restarting on every step.
  const latest = useRef({ shown, onYear });
  useEffect(() => {
    latest.current = { shown, onYear };
  });
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(
      () => {
        const current = latest.current;
        if (current.shown === null) return setPlaying(false);
        const next = stepTimelineYear(timeline, current.shown, 1);
        if (next !== current.shown) current.onYear(next);
        if (next === timeline.years.at(-1)) setPlaying(false);
      },
      reduced ? 1200 : 450,
    );
    return () => clearInterval(timer);
  }, [active, timeline, reduced]);

  const go = (next: number) => {
    setPlaying(false);
    onYear(next);
  };

  return (
    <section className={styles.timeline} aria-labelledby={`${id}-title`}>
      <p className={styles.kicker}>Modeled · not observed</p>
      <h4 id={`${id}-title`} className={styles.heading}>
        Recovery through time
      </h4>
      <p>
        Each cell’s recovery for every year from {first} to {last}, projected by the model from the
        summer {summer} state. Every year is a model estimate, including the years before {summer}:
        none of them is an observation. This control is separate from the whole-fire forecast.
      </p>
      <label className={styles.toggle}>
        <input
          type="checkbox"
          checked={shown !== null}
          onChange={(event) => {
            setPlaying(false);
            onYear(event.target.checked ? nearestTimelineYear(timeline, summer) : null);
          }}
        />{' '}
        Show modeled cell recovery
      </label>

      {shown !== null && (
        <div className={styles.player}>
          <p className={styles.readout}>
            <span className={styles.label}>Modeled cell recovery</span>
            <output className={styles.year} htmlFor={`${id}-year`}>
              {shown}
            </output>
            <span className={styles.kind}>{KIND[timelineYearKind(shown, summer)]}</span>
          </p>
          <div className={styles.buttons}>
            <button
              type="button"
              onClick={() => go(stepTimelineYear(timeline, shown, -1))}
              disabled={shown === first}
            >
              Previous year
            </button>
            <button
              type="button"
              aria-pressed={active}
              onClick={() => {
                if (active) return setPlaying(false);
                // Playing from the last year starts again at the first.
                if (shown === last) onYear(first);
                setPlaying(true);
              }}
            >
              {active ? 'Pause' : 'Play'}
            </button>
            <button
              type="button"
              onClick={() => go(stepTimelineYear(timeline, shown, 1))}
              disabled={shown === last}
            >
              Next year
            </button>
          </div>
          <input
            id={`${id}-year`}
            type="range"
            aria-label="Modeled cell year"
            min={0}
            max={years.length - 1}
            step={1}
            value={years.indexOf(shown)}
            aria-valuetext={`${shown}, ${KIND[timelineYearKind(shown, summer)].toLowerCase()}`}
            onChange={(event) => go(years[Number(event.target.value)]!)}
          />
          <div className={styles.range} aria-hidden>
            <span>{first}</span>
            <span>{last}</span>
          </div>
        </div>
      )}
    </section>
  );
}
