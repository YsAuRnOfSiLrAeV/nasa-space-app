import { cn } from '@/lib/utils';

/** Decorative line marks (aria-hidden): no data behind them. The brand mark is in components/shell. */

export function Spark() {
  return (
    <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" className="fill-foreground">
      <path d="M12 0c.6 6.5 5.5 11.4 12 12-6.5.6-11.4 5.5-12 12-.6-6.5-5.5-11.4-12-12C6.5 11.4 11.4 6.5 12 0z" />
    </svg>
  );
}

export function ArrowUpRight() {
  return (
    <svg
      aria-hidden
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
    >
      <path d="M7 17L17 7M9 7h8v8" />
    </svg>
  );
}

export function ArrowRight() {
  return (
    <svg
      aria-hidden
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M4 12h15M13 6l6 6-6 6" />
    </svg>
  );
}

/** Measurement tick ruler (decorative scale mark, p16). */
export function Ruler() {
  return (
    <span aria-hidden className="absolute right-8 bottom-4 flex items-end gap-1.5">
      {[8, 4, 4, 4, 12, 4, 4, 4, 8].map((h, i) => (
        <span
          key={i}
          className={cn('w-px', h === 12 ? 'bg-foreground' : 'bg-muted-foreground')}
          style={{ height: h }}
        />
      ))}
    </span>
  );
}
