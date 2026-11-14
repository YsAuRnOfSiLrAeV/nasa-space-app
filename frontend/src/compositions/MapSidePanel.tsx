import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * The panel every theme lays over the map: a column on desktop, a bottom sheet
 * on phones. It owns the shared contract once:
 *  - it is a `data-map-occluder`, so map fitting and controls avoid it;
 *  - on phones it docks to the bottom from `sheetTop`, leaving the map above;
 *  - `pinned` content never scrolls away (e.g. a theme switcher on a short screen);
 *  - only the body scrolls, and scrolling never chains to the page or the map.
 * Themes supply desktop placement and their own surface through `className`.
 */
export function MapSidePanel({
  label,
  sheetTop = '52%',
  pinned,
  className,
  bodyClassName,
  children,
}: {
  /** Accessible name of the panel (it is an `aside` landmark). */
  label: string;
  /** Where the phone bottom sheet starts, as a CSS length. */
  sheetTop?: string;
  /** Always-visible content above the scrolling body. */
  pinned?: ReactNode;
  /** Desktop placement and the theme's surface. */
  className?: string;
  /** Layout of the scrolling body. */
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <aside
      data-map-occluder
      aria-label={label}
      style={{ '--sheet-top': sheetTop } as CSSProperties}
      className={cn(
        'absolute z-10 flex flex-col',
        'max-md:inset-x-0 max-md:top-(--sheet-top) max-md:bottom-0',
        className,
      )}
    >
      {pinned && <div className="shrink-0">{pinned}</div>}
      <div className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain', bodyClassName)}>
        {children}
      </div>
    </aside>
  );
}
