import { useEffect, useSyncExternalStore } from 'react';
import { canonicalHash, parseRoute, type Route } from '@/app/route';

const subscribe = (onChange: () => void) => {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
};
const getHash = () => window.location.hash;

/** The current hash route; links are plain `<a href="#/…">`, so back/forward work. */
export function useHashRoute(): Route {
  const hash = useSyncExternalStore(subscribe, getHash, () => '');

  // A legacy address is rewritten in place: same page, no extra history entry.
  useEffect(() => {
    const current = canonicalHash(hash);
    if (current) window.history.replaceState(window.history.state, '', current);
  }, [hash]);

  // Parsed per render: cheap, and the string snapshot keeps the store stable.
  return parseRoute(hash);
}
