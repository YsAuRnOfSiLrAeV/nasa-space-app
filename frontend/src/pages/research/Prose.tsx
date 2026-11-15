import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

/** Running text of the research document: one readable measure, the theme's prose role. */
export function Prose({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn('prose-text max-w-[46rem] text-sm leading-relaxed', className)}>{children}</p>
  );
}
