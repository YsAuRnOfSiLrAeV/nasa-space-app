import type { FireData } from '@/data/fireSchema';

/** Missing resources are an explicit export limitation, never a synthetic grid. */
export function BundleAvailability({ data }: { data: FireData }) {
  const bundle = data.bundle;
  if (!bundle) return null;
  return (
    <section aria-label="Export availability">
      <p>
        {bundle.cells.length
          ? 'Spatial dataset supplied.'
          : 'Perimeter and summary only. No cell polygons or modeled cell values were exported.'}
      </p>
      {!bundle.cells.length && (
        <button type="button" disabled>
          Cell inspection unavailable · no spatial dataset supplied
        </button>
      )}
      {!bundle.timeline && (
        <label>
          <input type="checkbox" disabled /> Cell timeline unavailable · no timeline file supplied
        </label>
      )}
      {!data.result.lidar_points.length && <p>No measured GEDI observations supplied.</p>}
      {!data.opticalImageUrl && <p>No satellite image supplied.</p>}
    </section>
  );
}
