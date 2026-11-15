import type { FireData } from '@/data/fireSchema';

/** Missing resources are an explicit export limitation, never a synthetic grid. */
export function BundleAvailability({ data }: { data: FireData }) {
  const bundle = data.bundle;
  if (!bundle) return null;
  return (
    <section aria-label="Export availability">
      <p>
        {bundle.capabilities.perimeter ? 'Fire perimeter supplied.' : 'No fire perimeter supplied.'}
      </p>
      <p>
        {bundle.capabilities.spatial
          ? 'Spatial data available.'
          : 'Perimeter and summary only. No cell polygons or modeled cell values were exported.'}
      </p>
      <p>
        {bundle.capabilities.timeline ? 'Cell timeline available.' : 'No cell timeline supplied.'}
      </p>
      <p>
        {bundle.capabilities.forecast
          ? 'Whole-fire forecast available.'
          : 'No whole-fire forecast supplied.'}
      </p>
      <p>
        {data.result.lidar_points.length
          ? `${data.result.lidar_points.length} measured GEDI observations supplied.`
          : 'No measured GEDI observations supplied.'}
      </p>
      <p>{data.opticalImageUrl ? 'Satellite image supplied.' : 'No satellite image supplied.'}</p>
    </section>
  );
}
