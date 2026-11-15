import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import type { Section } from '@/app/route';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { SiteNav } from './SiteNav';
import { APP_TITLE } from './brand';
import { usePageActive } from '@/app/pageActive';
import styles from './page.module.css';

/**
 * The shell of every page that is a scrolling document (all but the explorer):
 * full screen, the theme backdrop, the primary navigation floating on top and
 * one content column.
 */
export function PageLayout({
  section,
  scrollRef,
  children,
}: {
  /** The navigation section this page belongs to. */
  section: Section;
  /** The scroll container, for pages that reset the scroll position themselves. */
  scrollRef?: RefObject<HTMLDivElement | null>;
  children: ReactNode;
}) {
  return (
    <div ref={scrollRef} className={cn('nasa-page', styles.enter)}>
      <header className="pointer-events-none fixed inset-x-0 top-0 z-10">
        <SiteNav current={section} />
      </header>
      <main className="nasa-main-content">{children}</main>
    </div>
  );
}

/**
 * A page's opening block: eyebrow, title and a short lede in the shared type
 * scale. Opening the page names it in the tab and moves focus to its title.
 */
export function PageIntro({
  eyebrow,
  title,
  className,
  children,
}: {
  eyebrow: string;
  title: string;
  className?: string;
  children?: ReactNode;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const active = usePageActive();

  useEffect(() => {
    if (!active) return;
    document.title = `${title} · ${APP_TITLE}`;
    headingRef.current?.focus({ preventScroll: true });
    return () => {
      document.title = APP_TITLE;
    };
  }, [title, active]);

  return (
    <section className={cn('nasa-page-header', className)}>
      <p className="nasa-page-header-eyebrow">{eyebrow}</p>
      <h1 ref={headingRef} tabIndex={-1} className="nasa-page-header-title outline-none">
        {title}
      </h1>
      {children && <div className="nasa-page-header-subtitle">{children}</div>}
    </section>
  );
}

/**
 * Shown while a page's code is fetched on its first visit: the page backdrop
 * and content column with a status line and the outline of an intro, so the
 * wait reads as loading, not as a blank screen. It appears only after a short
 * delay, so a fast load never flashes it. No navigation: the page brings its
 * own, and it should arrive once.
 */
export function PageLoading({ label = 'Loading page' }: { label?: string }) {
  return (
    <div className={cn('nasa-page', styles.loading)}>
      <div role="status" aria-live="polite" className="nasa-main-content">
        <p className="nasa-page-header-eyebrow">{label}…</p>
        <div aria-hidden className="nasa-space-lg max-w-[46rem] nasa-stack">
          <Skeleton className="h-12 w-3/4 md:h-16" />
          <div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      </div>
    </div>
  );
}
