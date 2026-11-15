import type { FireData } from '@/data/fireSchema';
import { timelineRow } from '@/domain/fire/cellTimeline';

export function SpatialCellReadout({
  data,
  index,
  year,
}: {
  data: FireData;
  index: number;
  year?: number | null;
}) {
  const bundle = data.bundle!;
  const i = bundle.cells.findIndex(
    (cell) => cell.row * data.result.map_grid.columns + cell.col === index,
  );
  const cell = bundle.cells[i];
  if (!cell) return <p>No supplied polygon at this grid position.</p>;
  const value = (number: number | null, unit = '') =>
    number == null ? 'Not supplied' : `${number}${unit}`;
  const timeline = bundle.timeline && year != null ? timelineRow(bundle.timeline, year) : null;
  return (
    <div>
      <p>
        Cell {i} · row {cell.row}, column {cell.col} (source indices) · source summer{' '}
        {data.result.satellite_images.summer}
      </p>
      <dl>
        <dt>Modeled recovery · source summer {data.result.satellite_images.summer}</dt>
        <dd>
          {value(
            cell.recovery === null ? null : Number((cell.recovery * 100).toFixed(2)),
            '% of reference forest height',
          )}
        </dd>
        <dt>Modeled canopy height</dt>
        <dd>{value(cell.height_m, ' m')}</dd>
        <dt>NDVI · unitless</dt>
        <dd>{value(cell.ndvi)}</dd>
        <dt>Relative model score · not calibrated probability</dt>
        <dd>{value(cell.p_forest_gt5)}</dd>
        {timeline && (
          <>
            <dt>Modeled cell recovery · {year}</dt>
            <dd>{value(timeline[i] ?? null, '% of reference forest height')}</dd>
          </>
        )}
      </dl>
      <p>
        Source: {data.result.fire.id} · cells.json (recovery, height_m, ndvi, p_forest_gt5);
        cells.geojson polygon i={i}.
        {timeline
          ? ` Timeline: timeline.json → recovery_pct[${bundle.timeline!.years.indexOf(year!)}][${i}].`
          : ''}
      </p>
    </div>
  );
}
