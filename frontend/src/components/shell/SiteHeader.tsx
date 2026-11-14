import { useEffect, useState, type CSSProperties, type Ref, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { BrandMark } from './BrandMark';
import { APP_TITLE } from './brand';
import { useMenuDialog } from './useMenuDialog';
import styles from './nav.module.css';

interface BaseItem {
  id: string;
  label: string;
  /** Marks where the reader is: a page (link) or a view (button). */
  current?: boolean;
  disabled?: boolean;
}
export type NavItem = BaseItem &
  (
    | { href: string }
    | { onSelect: () => void; /** For a panel toggle. */ expanded?: boolean; controls?: string }
  );

/** The brand mark: a link (Recovery → explorer) or an action (explorer → planet view). */
export type Brand = { href: string; label: string } | { onSelect: () => void; label: string };

/** Set once the first header has mounted: the entrance plays once per visit, not per page. */
let headerHasEntered = false;

/**
 * The app's header, shared by both pages: an open row with no box, the brand
 * at the left and numbered items at the right. Below `md` the items move into
 * a full-screen menu behind a two-line toggle that turns into an X.
 */
export function SiteHeader({
  label,
  items,
  brand,
  fade = true,
  className,
  center,
}: {
  /** Accessible name of the navigation landmark. */
  label: string;
  items: NavItem[];
  brand: Brand;
  /** Fade the page out behind the header. Off where nothing passes beneath it. */
  fade?: boolean;
  className?: string;
  center?: ReactNode;
}) {
  const { open, id, toggleRef, menuRef, toggle, close, onKeyDown } = useMenuDialog();
  const [enter] = useState(() => !headerHasEntered);
  useEffect(() => {
    headerHasEntered = true;
  }, []);
  return (
    <div
      className={cn(styles.header, center && styles.shell, className)}
      data-fade={fade || undefined}
      onKeyDown={onKeyDown}
    >
      <nav aria-label={label} className={styles.row} data-enter={enter || undefined}>
        <BrandLink brand={brand} />
        {center}
        <NavLinks items={items} />
        {!center && <MenuToggle ref={toggleRef} open={open} controls={id} onToggle={toggle} />}
      </nav>
      {!center && (
        <PhoneMenu
          ref={menuRef}
          id={id}
          open={open}
          items={items}
          label={label}
          onChoose={() => close(false)}
        />
      )}
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

/** Wide screens: the items in a row, numbered by CSS like the section headings. */
function NavLinks({ items }: { items: NavItem[] }) {
  return (
    <ul className={styles.links}>
      {items.map((item) => (
        <li key={item.id}>
          <NavEntry item={item} className={styles.item} />
        </li>
      ))}
    </ul>
  );
}

/** Phones: two hairlines that rotate into an X. */
function MenuToggle({
  ref,
  open,
  controls,
  onToggle,
}: {
  ref: Ref<HTMLButtonElement>;
  open: boolean;
  controls: string;
  onToggle: () => void;
}) {
  return (
    <button
      ref={ref}
      type="button"
      className={styles.toggle}
      aria-expanded={open}
      aria-controls={controls}
      aria-label={open ? 'Close menu' : 'Open menu'}
      onClick={onToggle}
    >
      <span aria-hidden />
      <span aria-hidden />
    </button>
  );
}

/** Phones: the items as a screen-filling list that rises in one after another. */
function PhoneMenu({
  ref,
  id,
  open,
  items,
  label,
  onChoose,
}: {
  ref: Ref<HTMLDivElement>;
  id: string;
  open: boolean;
  items: NavItem[];
  label: string;
  /** Called after an item is chosen (closes the menu). */
  onChoose: () => void;
}) {
  return (
    <div
      ref={ref}
      id={id}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      data-open={open || undefined}
      inert={!open}
      className={styles.menu}
    >
      <ul className={styles.menuList}>
        {items.map((item, i) => (
          <li key={item.id}>
            <NavEntry item={item} className={styles.menuItem} index={i} onDone={onChoose} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function NavEntry({
  item,
  className,
  index,
  onDone,
}: {
  item: NavItem;
  className?: string;
  /** Position in the phone menu: numbers it and staggers its entrance. */
  index?: number;
  /** Called after the item is chosen (closes the phone menu). */
  onDone?: () => void;
}) {
  const style = index === undefined ? undefined : ({ '--i': index } as CSSProperties);
  const content =
    index === undefined ? (
      item.label
    ) : (
      <>
        <small>{String(index + 1).padStart(2, '0')}</small>
        {item.label}
      </>
    );
  if ('href' in item) {
    return (
      <a
        href={item.href}
        aria-current={item.current ? 'page' : undefined}
        className={className}
        style={style}
        onClick={onDone}
      >
        {content}
      </a>
    );
  }
  return (
    <button
      type="button"
      aria-current={item.current ? 'true' : undefined}
      aria-expanded={item.expanded}
      aria-controls={item.controls}
      disabled={item.disabled}
      className={className}
      style={style}
      onClick={() => {
        item.onSelect();
        onDone?.();
      }}
    >
      {content}
    </button>
  );
}
