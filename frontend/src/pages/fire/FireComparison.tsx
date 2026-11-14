import { useState } from 'react';
import type { FireData } from '@/data/fireSchema';
import { percent } from './fireSpatial';
import styles from './Fire.module.css';

export function FireComparison({ data }: { data: FireData }) {
  const comparison = data.result.comparison;
  const rows = [
    {
      name: 'Optical greenness indicator',
      value: comparison?.optics,
      basis: 'Optical index',
      color: 'var(--forest)',
    },
    {
      name: 'Forest structure',
      value: comparison?.model,
      basis: 'Model estimate',
      color: 'var(--stage-2)',
    },
    {
      name: 'GEDI height reference',
      value: comparison?.lidar,
      basis: 'Lidar comparison',
      color: 'var(--silver)',
    },
  ];
  const maximum = Math.max(1, ...rows.map((row) => row.value ?? 0));
  return (
    <section aria-labelledby="fire-comparison-title">
      <h2 id="fire-comparison-title" className={styles.sectionTitle}>
        Greenness and forest structure
      </h2>
      <table className={styles.table}>
        <caption className="sr-only">
          Supplied recovery indicators for the fire. Values use the definitions in the result file.
        </caption>
        <thead>
          <tr>
            <th scope="col">Perspective</th>
            <th scope="col">Evidence</th>
            <th scope="col">Supplied indicator</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name}>
              <th scope="row">{row.name}</th>
              <td>{row.basis}</td>
              <td>
                <span>{percent(row.value, 100)}</span>
                <div aria-hidden className="mt-2 ml-auto h-1 w-24 bg-(--rule) sm:w-40">
                  {row.value != null && (
                    <div
                      className="h-full"
                      style={{ width: `${(row.value / maximum) * 100}%`, background: row.color }}
                    />
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4 max-w-[70ch] text-sm leading-relaxed text-muted-foreground">
        Optical greenness can return as grasses and shrubs grow. Structural recovery is expressed
        relative to the neighbouring forest’s height. The optical indicator follows the supplied
        export’s definition, which still needs scientific confirmation for the example.
      </p>
      {comparison && (
        <p className="mt-3 text-xs text-muted-foreground">
          The comparison reports {comparison.lidar_points_in_fire} lidar points. The map has{' '}
          {data.result.lidar_points.length} supplied coordinates. Acquisition dates for those lidar
          points are not supplied.
        </p>
      )}
      <OpticalImage key={data.opticalImageUrl} url={data.opticalImageUrl} />
    </section>
  );
}

function OpticalImage({ url }: { url: string | null }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed)
    return (
      <p className={`${styles.notice} mt-4`}>
        An optical image has not been supplied or could not be loaded. Cell-level NDVI is available
        in the map layer selector where supplied.
      </p>
    );
  return (
    <figure className="mt-4">
      <img
        src={url}
        alt="Supplied optical scene covering the fire grid"
        loading="lazy"
        onError={() => setFailed(true)}
        className="max-h-[36rem] w-full object-contain"
      />
      <figcaption className="mt-2 text-xs text-muted-foreground">
        Optical scene supplied with this result.
      </figcaption>
    </figure>
  );
}
