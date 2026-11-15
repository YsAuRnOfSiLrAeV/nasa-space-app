import type { CellDescription } from '../../domain/fire/fireGrid';

/** One cell's categories, shared by the map tooltip and the keyboard inspector. */
export function CellDetails({
  cell,
  titleClassName,
}: {
  cell: CellDescription;
  titleClassName?: string;
}) {
  return (
    <>
      <p className={titleClassName}>Cell</p>
      {cell.supplied ? (
        <dl>
          <dt>Area</dt>
          <dd>{cell.area}</dd>
          <dt>{cell.layerLabel}</dt>
          <dd>{cell.value}</dd>
          {cell.modeledHeight !== undefined && (
            <>
              <dt>Modeled canopy height · source summer</dt>
              <dd>{cell.modeledHeight === null ? 'Not supplied' : `${cell.modeledHeight} m`}</dd>
            </>
          )}
          {cell.domain && (
            <>
              <dt>Pipeline flag</dt>
              <dd>{cell.domain}</dd>
            </>
          )}
          {cell.reburnYear !== null && (
            <>
              <dt>Repeat fire</dt>
              <dd>Burned again in {cell.reburnYear}</dd>
            </>
          )}
        </dl>
      ) : (
        <p>No data supplied for this cell. Missing cells are not interpolated.</p>
      )}
    </>
  );
}
