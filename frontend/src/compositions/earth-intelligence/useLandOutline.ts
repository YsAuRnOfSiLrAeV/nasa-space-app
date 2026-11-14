import { useEffect, useState } from 'react';
// The Natural Earth file already in the repo, emitted by Vite as a hashed asset
// and fetched on demand (it is not bundled into the JavaScript).
import landUrl from '../../../data/reference/ne_110m_land.geojson?url';
import { parseLandRings, type LandRing } from './planet/landOutline';

/** Natural Earth 1:110m land rings for the globe, or null while loading or if unavailable. */
export function useLandOutline(): LandRing[] | null {
  const [rings, setRings] = useState<LandRing[] | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(landUrl, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((json: unknown) => {
        if (!controller.signal.aborted) setRings(parseLandRings(json));
      })
      .catch(() => {
        // The globe still draws its grid, limb, observations and fires without land.
      });
    return () => controller.abort();
  }, []);
  return rings;
}
