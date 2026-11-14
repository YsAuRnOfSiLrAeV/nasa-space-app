import type { ReactNode } from 'react';
import ui from './primitives.module.css';

/**
 * States plainly that part of a page is not built yet and what it waits for.
 * Used instead of sample content: nothing is shown in place of missing data.
 */
export function PendingNote({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="note" className="max-w-[46rem] space-y-3 border-t border-rule pt-6">
      <p className={ui.micro}>{label}</p>
      <p className="prose-text text-sm leading-relaxed">{children}</p>
    </div>
  );
}
