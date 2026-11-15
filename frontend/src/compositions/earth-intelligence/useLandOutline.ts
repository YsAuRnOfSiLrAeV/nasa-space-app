import { useResource } from '@/hooks/useResource';
import { studyDataApi } from '@/services/data';
// The Natural Earth file already in the repo, emitted by Vite as a hashed asset
// and fetched on demand (it is not bundled into the JavaScript).
import landUrl from '../../../data/reference/ne_110m_land.geojson?url';

/**
 * Natural Earth 1:110m land rings for the globe, or null while loading or if
 * unavailable: the globe still draws its grid, limb, observations and fires without land.
 */
export function useLandOutline() {
  return useResource('land-outline', (signal) => studyDataApi.loadLandOutline(landUrl, signal));
}
