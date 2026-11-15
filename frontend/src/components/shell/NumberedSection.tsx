import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { keepGreekCase } from '@/lib/text';
import ui from './primitives.module.css';

/**
 * Numbered section with an instrument-style heading: "03 Canopy height" and a
 * right-aligned source caption. The caption is decorative (aria-hidden); the
 * sources list carries the detail.
 */
export function NumberedSection({
  id: sectionId,
  n,
  title,
  meta,
  className,
  children,
}: {
  /** Anchor for in-page contents; the heading can then be focused from there. */
  id?: string;
  n: string;
  title: string;
  /** Right-aligned caption (data source or method). */
  meta?: string;
  className?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section
      id={sectionId}
      aria-labelledby={id}
      className={cn('min-w-0', sectionId && 'scroll-mt-28', className)}
    >
      <h2
        id={id}
        tabIndex={sectionId ? -1 : undefined}
        className={cn(ui.sectionHead, 'outline-none')}
      >
        <span>{n}</span>
        {title}
        {meta && (
          <span aria-hidden className={cn(ui.micro, 'ml-auto text-[9px] tracking-[0.18em]')}>
            {keepGreekCase(meta)}
          </span>
        )}
      </h2>
      {children}
    </section>
  );
}
