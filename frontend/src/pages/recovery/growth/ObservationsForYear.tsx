import { cn } from '@/lib/utils';
import type { RecoveryFile } from '@/data/recoverySchema';
import {
  observationsForYear,
  observedYears,
  platformLabel,
  type GroupRecovery,
  type YearObservation,
} from '@/domain/study/recovery';
import { MAX_YEAR } from '@/domain/forest/growth';
import ui from '@/components/shell/primitives.module.css';

/**
 * What was actually observed in the calendar year that matches the
 * illustration's year. Strictly separate from the drawing: values here are
 * measurements (from the tested `observationsForYear`), and the drawing is
 * never scaled to them.
 */
export function ObservationsForYear({
  year,
  r,
  landsat,
  referenceYear,
}: {
  year: number;
  r: GroupRecovery;
  landsat: RecoveryFile | null;
  referenceYear: number;
}) {
  const obs = observationsForYear(r, landsat, r.group.fireYear + year, referenceYear);
  const cal = obs.calendarYear;

  return (
    <aside
      aria-labelledby="growth-observed"
      aria-live="polite"
      className="rounded-(--radius) border border-rule p-4"
    >
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 id="growth-observed" className="text-sm text-foreground">
          Measured in {cal}
        </h3>
        <span className={cn(ui.micro, 'text-[9px]')}>Observations · not the drawing</span>
      </div>
      {obs.future ? (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {cal} is after the most recent observations ({referenceYear}). Nothing has been measured;
          the drawing continues to year {MAX_YEAR} for illustration only.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {obs.rows.map((row) => (
            <ObservationRow key={row.source} row={row} />
          ))}
        </ul>
      )}
      {obs.image && (
        <figure className="mt-3 flex items-center gap-3">
          <img
            src={obs.image.natural}
            alt={`Landsat natural-colour image, ${obs.image.date}`}
            className="aspect-square w-20 rounded-sm border border-rule object-fill"
            loading="lazy"
          />
          <figcaption className="text-[11px] leading-relaxed text-muted-foreground">
            Landsat scene, {obs.image.date} ({platformLabel(obs.image.platform)}). Real image of
            this group in {cal}.
          </figcaption>
        </figure>
      )}
      <p className="mt-3 border-t border-rule pt-3 text-[11px] leading-relaxed text-muted-foreground">
        The illustration is not scaled to these values. Tree sizes in the drawing are not
        measurements.
      </p>
    </aside>
  );
}

function ObservationRow({ row }: { row: YearObservation }) {
  return (
    <li className="text-xs leading-relaxed">
      <span className={cn(ui.micro, 'block text-[9px]', row.measured && 'text-(--forest)')}>
        {row.measured ? '● ' : '○ '}
        {row.source}
      </span>
      <span className={row.measured ? 'text-foreground' : 'text-muted-foreground'}>{row.text}</span>
    </li>
  );
}

/**
 * Year ribbon under the controls: which years since the fire have a real
 * observation (dots), and where observations end. Decorative; the panel and
 * slider carry the information.
 */
export function ObservationRibbon({
  year,
  r,
  landsat,
  referenceYear,
}: {
  year: number;
  r: GroupRecovery;
  landsat: RecoveryFile | null;
  referenceYear: number;
}) {
  const fire = r.group.fireYear;
  const lastObserved = referenceYear - fire;
  const pct = (y: number) => `${(y / MAX_YEAR) * 100}%`;
  const observed = observedYears(r, landsat);
  const ndviYears = new Set(observed.ndvi.map((y) => y - fire));
  const gediYears = new Set(observed.gedi.map((y) => y - fire));
  return (
    <div aria-hidden className="relative h-5">
      <span
        className="absolute inset-y-0 right-0 bg-[repeating-linear-gradient(135deg,var(--rule)_0_2px,transparent_2px_6px)]"
        style={{ left: pct(Math.min(MAX_YEAR, lastObserved + 0.5)) }}
      />
      {Array.from({ length: MAX_YEAR + 1 }, (_, y) => (
        <span key={y} className="absolute top-0 -translate-x-1/2" style={{ left: pct(y) }}>
          {ndviYears.has(y) && (
            <span className="mx-auto block size-1 rounded-full bg-foreground/60" />
          )}
          {gediYears.has(y) && (
            <span className="mx-auto mt-0.5 block size-1.5 rotate-45 bg-(--forest)" />
          )}
        </span>
      ))}
      <span className="absolute top-0 bottom-0 w-px bg-(--select)" style={{ left: pct(year) }} />
    </div>
  );
}
