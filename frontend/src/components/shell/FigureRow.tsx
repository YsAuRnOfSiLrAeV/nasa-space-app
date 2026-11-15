import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface Figure {
  id: string;
  value: string;
  label: ReactNode;
}

/**
 * Measured figures read as one line of text ("30 points · 6.3 m median canopy …"),
 * not as boxed big numbers: the numbers support the story, they are not the story.
 */
export function FigureRow({ figures, className }: { figures: Figure[]; className?: string }) {
  return (
    <dl className={cn('flex flex-wrap items-baseline gap-x-5 gap-y-1.5', className)}>
      {figures.map((f) => (
        <div key={f.id} className="flex items-baseline gap-1.5">
          <dt className="order-last text-xs text-muted-foreground">{f.label}</dt>
          <dd className="font-(family-name:--font-numeric) text-lg leading-none text-foreground tabular-nums">
            {f.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
