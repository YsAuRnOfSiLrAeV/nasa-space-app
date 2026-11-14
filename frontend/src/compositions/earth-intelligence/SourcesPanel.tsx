import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { SourcesList } from '@/components/study/SourcesList';
import type { StudyView } from '../types';
import primitives from '@/components/shell/primitives.module.css';
import styles from './EarthIntelligence.module.css';

export const SOURCES_PANEL_ID = 'ei-sources';

/** Floating Sources & method panel. Focus moves in on open and back to the opener on close. */
export function SourcesPanel({ study, onClose }: { study: StudyView | null; onClose: () => void }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    ref.current?.focus();
    return () => opener?.focus();
  }, []);

  return (
    <section
      id={SOURCES_PANEL_ID}
      ref={ref}
      tabIndex={-1}
      aria-labelledby="ei-sources-title"
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      // Opaque: the module's translucent panel fill would let the analysis show through.
      style={{ background: 'var(--popover)' }}
      className={cn(
        styles.panel,
        'absolute top-[4.75rem] right-4 left-4 z-40 max-h-[70vh] overflow-y-auto p-5 outline-none md:left-auto md:w-[440px]',
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <h2 id="ei-sources-title" className={cn(primitives.sectionHead, 'flex-1')}>
          <span>i</span>Sources &amp; method
        </h2>
        <button type="button" className={primitives.ghost} onClick={onClose}>
          Close
        </button>
      </div>
      <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
        The globe&apos;s rotation and the flight into the region are display only: nothing here is
        live tracking or real-time data.
      </p>
      <SourcesList manifest={study?.manifest ?? null} points={study?.points ?? []} />
    </section>
  );
}
