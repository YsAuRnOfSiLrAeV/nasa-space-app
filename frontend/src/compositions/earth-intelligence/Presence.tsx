import { useEffect, useState, type ReactNode } from 'react';

/** How long a panel takes to leave; matches the exit animations in MapShell.module.css. */
export const EXIT_MS = 220;

/**
 * Keeps a panel on screen while it animates out. While `show` is true it renders
 * its children with `data-state="open"`; when `show` turns false it keeps the last
 * shown children for EXIT_MS with `data-state="closing"` (inert), then unmounts.
 * The animations themselves are CSS, so reduced motion shortens them.
 */
export function Presence({
  show,
  className,
  children,
}: {
  show: boolean;
  className?: string;
  children: ReactNode;
}) {
  // The last children shown, so a closing panel still has its content. Updated
  // during render when they change (React re-renders once with the same props).
  const [kept, setKept] = useState<ReactNode>(show ? children : null);
  if (show && kept !== children) setKept(children);
  const [leaving, setLeaving] = useState(false);
  const [wasShown, setWasShown] = useState(show);
  if (show !== wasShown) {
    setWasShown(show);
    setLeaving(!show);
  }
  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(() => setLeaving(false), EXIT_MS);
    return () => clearTimeout(timer);
  }, [leaving]);
  if (!show && !leaving) return null;
  return (
    <div className={className} data-state={show ? 'open' : 'closing'} inert={!show}>
      {show ? children : kept}
    </div>
  );
}
