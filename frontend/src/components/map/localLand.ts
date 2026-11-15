import type { Map as MapLibreMap } from 'maplibre-gl';
// The Natural Earth file already in the repo (also used by the landing globe),
// emitted by Vite as a hashed asset: served by the app itself, not a tile service.
import landUrl from '../../../data/reference/ne_110m_land.geojson?url';
import { LAYER_IMAGERY, LAYER_LAND_FILL, LAYER_LAND_LINE, SOURCE_LAND } from './layers';

/**
 * Muted land polygons and coastline under the satellite imagery. Opaque imagery hides
 * them where its tiles load; where GIBS or the vector tiles fail, the map still shows
 * geography. Colours and visibility come from the theme (applyMapTheme).
 */
export function addLocalLand(map: MapLibreMap, url: string = landUrl): void {
  if (map.getSource(SOURCE_LAND)) return;
  map.addSource(SOURCE_LAND, {
    type: 'geojson',
    data: url,
    attribution: 'Natural Earth',
  });
  const before = map.getLayer(LAYER_IMAGERY) ? LAYER_IMAGERY : undefined;
  map.addLayer(
    {
      id: LAYER_LAND_FILL,
      type: 'fill',
      source: SOURCE_LAND,
      layout: { visibility: 'none' },
      paint: { 'fill-color': '#1a1b1e' },
    },
    before,
  );
  map.addLayer(
    {
      id: LAYER_LAND_LINE,
      type: 'line',
      source: SOURCE_LAND,
      layout: { visibility: 'none' },
      paint: { 'line-color': '#3a3c42', 'line-width': 0.75 },
    },
    before,
  );
}
