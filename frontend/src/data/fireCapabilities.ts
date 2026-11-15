import type { FireBundle, FireCapabilities } from './fireTypes';

/** The file names bundle format 2 uses. The picture's name comes from `result.image.file`. */
export const BUNDLE_FILES = {
  manifest: 'manifest.json',
  result: 'result.json',
  perimeter: 'polygon.geojson',
  cells: 'cells.json',
  cellGeometry: 'cells.geojson',
  observations: 'gedi.geojson',
  timeline: 'timeline.json',
} as const;

/**
 * What a loaded fire actually has. A catalog entry carries the same keys computed from
 * its declared file list (`bundleIndexEntry`); this is the authority once a fire is open.
 */
export function bundleCapabilities(
  bundle: Pick<
    FireBundle,
    'perimeter' | 'cells' | 'observations' | 'image' | 'timeline' | 'forecast'
  >,
): FireCapabilities {
  return {
    spatial: bundle.cells.length > 0,
    perimeter: bundle.perimeter !== null,
    imagery: bundle.image !== null,
    gedi: bundle.observations.length > 0,
    timeline: bundle.timeline !== null,
    forecast: bundle.forecast.kind === 'growth',
  };
}
