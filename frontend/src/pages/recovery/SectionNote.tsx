import type { ReactNode } from 'react';

/** Explanatory text under a section heading. */
export function SectionNote({ children }: { children: ReactNode }) {
  return (
    <p className="mb-7 max-w-[46rem] text-xs leading-relaxed text-muted-foreground">{children}</p>
  );
}
