import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { gediYearRange, studySources } from '@/data/sources';
import type { Manifest, PointProperties } from '@/data/schema';

/**
 * Data provenance: what each dataset contributes, its credit and its limits.
 * Typography follows the theme (label / prose roles); layout is the caller's.
 */
export function SourcesList({
  manifest,
  points,
  className,
}: {
  manifest: Manifest | null;
  points: PointProperties[];
  className?: string;
}) {
  const groups = useMemo(() => studySources(manifest, gediYearRange(points)), [manifest, points]);

  return (
    <div className={cn('space-y-5', className)}>
      {groups.map((g) => (
        <section key={g.title} aria-label={g.title}>
          <h3 className="type-label mb-2 text-[10px] font-medium tracking-[0.16em] text-muted-foreground uppercase">
            {g.title}
          </h3>
          <ul className="divide-y divide-rule border-y border-rule">
            {g.sources.map((s) => (
              <li key={s.id} className="py-2.5 text-xs leading-relaxed">
                <p className="font-medium text-foreground">{s.name}</p>
                <p className="mt-0.5 text-muted-foreground">{s.use}</p>
                <p className="mt-1 text-muted-foreground">
                  <span className="text-foreground">Credit:</span> {s.credit}
                </p>
                <p className="mt-0.5 text-muted-foreground">
                  <span className="text-foreground">Limits:</span> {s.limits}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
