import type { ReactNode } from 'react';
import { keepGreekCase } from '@/lib/text';
import styles from './ResearchLab.module.css';

/** Bracketed, lettered instrument module (moodboard p03), not a card. */
export function InstrumentModule({
  index,
  title,
  meta,
  children,
}: {
  index: string;
  title: string;
  /** Right-aligned caption, e.g. data source or unit. */
  meta?: string;
  children: ReactNode;
}) {
  const id = `rl-module-${index}`;
  return (
    <section aria-labelledby={id} className={styles.module}>
      <span className={styles.corners} aria-hidden />
      <header className="mb-3 flex items-center gap-2.5">
        <span className={styles.index} aria-hidden>
          {index}
        </span>
        <h2 id={id} className={styles.label} style={{ color: 'var(--foreground)' }}>
          {title}
        </h2>
        {meta && <span className={`${styles.label} ml-auto`}>{keepGreekCase(meta)}</span>}
      </header>
      {children}
    </section>
  );
}
