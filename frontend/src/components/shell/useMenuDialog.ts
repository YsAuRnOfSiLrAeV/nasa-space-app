import { useEffect, useId, useRef, useState, type KeyboardEvent, type RefObject } from 'react';

const FOCUSABLE = 'a, button:not(:disabled)';

export interface MenuDialog {
  open: boolean;
  /** Id for the menu element (the toggle's `aria-controls`). */
  id: string;
  toggleRef: RefObject<HTMLButtonElement | null>;
  menuRef: RefObject<HTMLDivElement | null>;
  toggle: () => void;
  /** Closes the menu; by default focus returns to the toggle. */
  close: (refocus?: boolean) => void;
  /** Escape closes; Tab cycles toggle → items while open. */
  onKeyDown: (e: KeyboardEvent) => void;
}

/**
 * State and keyboard behaviour of a full-screen menu opened by a toggle:
 * opening focuses the first item, Escape closes and returns focus to the
 * toggle, and Tab stays inside (toggle and items) while it is open.
 */
export function useMenuDialog(): MenuDialog {
  const [open, setOpen] = useState(false);
  const id = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) menuRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
  }, [open]);

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) toggleRef.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (!open) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (e.key !== 'Tab') return;
    const focusables = [
      toggleRef.current,
      ...(menuRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []),
    ].filter((el): el is HTMLElement => !!el);
    const i = focusables.indexOf(document.activeElement as HTMLElement);
    const next = e.shiftKey ? (i <= 0 ? focusables.length : i) - 1 : (i + 1) % focusables.length;
    e.preventDefault();
    focusables[next]?.focus();
  };

  return { open, id, toggleRef, menuRef, toggle: () => setOpen((o) => !o), close, onKeyDown };
}
