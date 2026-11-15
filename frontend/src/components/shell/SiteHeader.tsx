import { useEffect, useState, type ReactNode } from 'react';
import { BrandMark } from './BrandMark';
import { APP_TITLE } from './brand';
import styles from './nav.module.css';

export interface NavItem {
  id: string;
  label: string;
  href: string;
  /** Marks the page the reader is on. */
  current?: boolean;
}

/** The brand mark: a link (a page → explorer) or an action (explorer → planet view). */
export type Brand = { href: string; label: string } | { onSelect: () => void; label: string };

/** Set once the first header has mounted: the entrance plays once per visit, not per page. */
let headerHasEntered = false;

/**
 * The app's header, shared by every page: an open row with no box, the brand at
 * the left, the map modes in the centre and the page links at the right. On
 * phones the modes move to a second row.
 */
export function SiteHeader({
  label,
  items,
  brand,
  fade = true,
  center,
}: {
  /** Accessible name of the navigation landmark. */
  label: string;
  items: NavItem[];
  brand: Brand;
  /** Fade the page out behind the header. Off where nothing passes beneath it. */
  fade?: boolean;
  center: ReactNode;
}) {
  const [enter] = useState(() => !headerHasEntered);
  useEffect(() => {
    headerHasEntered = true;
  }, []);
  return (
    <div className={styles.header} data-fade={fade || undefined}>
      <nav aria-label={label} className={styles.row} data-enter={enter || undefined}>
        <BrandLink brand={brand} />
        {center}
        <ul className={styles.links}>
          {items.map((item) => (
            <li key={item.id}>
              <a
                href={item.href}
                aria-current={item.current ? 'page' : undefined}
                className={styles.item}
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

function BrandLink({ brand }: { brand: Brand }) {
  const content = (
    <>
      <BrandMark />
      <span className="max-sm:sr-only">{APP_TITLE}</span>
    </>
  );
  return 'href' in brand ? (
    <a href={brand.href} className={styles.brand} aria-label={brand.label}>
      {content}
    </a>
  ) : (
    <button
      type="button"
      className={styles.brand}
      aria-label={brand.label}
      onClick={brand.onSelect}
    >
      {content}
    </button>
  );
}
