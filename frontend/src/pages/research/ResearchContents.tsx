import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import ui from '@/components/shell/primitives.module.css';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import styles from './research.module.css';

export interface ContentsEntry {
  id: string;
  n: string;
  title: string;
}

/**
 * "On this page": the document's sections, with the one being read marked.
 * Buttons, not links: the URL hash is the app's route, so in-page anchors would
 * navigate away. Choosing an entry scrolls to its section and focuses its heading.
 */
export function ResearchContents({
  entries,
  className,
}: {
  entries: ContentsEntry[];
  className?: string;
}) {
  const current = useCurrentSection(entries);
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');

  const go = (id: string) => {
    const section = document.getElementById(id);
    if (!section) return;
    section.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    section.querySelector('h2')?.focus({ preventScroll: true });
  };

  return (
    <nav aria-label="On this page" className={className}>
      <p className={cn(ui.micro, 'mb-4 text-[9px]')}>On this page</p>
      <ol className={styles.contents}>
        {entries.map((e) => (
          <li key={e.id}>
            <button
              type="button"
              className={styles.entry}
              aria-current={e.id === current ? 'true' : undefined}
              onClick={() => go(e.id)}
            >
              <span aria-hidden>{e.n}</span>
              {e.title}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** The section crossing the upper third of the screen, or the first one before any has. */
function useCurrentSection(entries: ContentsEntry[]): string | null {
  const [current, setCurrent] = useState<string | null>(entries[0]?.id ?? null);
  const key = entries.map((e) => e.id).join(' ');

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const visible = new Set<string>();
    const order = key.split(' ');
    const io = new IntersectionObserver(
      (records) => {
        for (const r of records) {
          if (r.isIntersecting) visible.add(r.target.id);
          else visible.delete(r.target.id);
        }
        const first = order.find((id) => visible.has(id));
        if (first) setCurrent(first);
      },
      { rootMargin: '-30% 0px -60% 0px' },
    );
    for (const id of order) {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, [key]);

  return current;
}
