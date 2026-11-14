import type { ReactNode } from 'react';
import { recoveryHref } from '@/app/route';
import { formatLonLat } from '@/components/map/graticule';
import type { LocatedPoint } from '@/data/schema';
import { STAGE_LABELS } from '@/styles/tokens';
import primitives from '@/components/shell/primitives.module.css';
import styles from './EarthIntelligence.module.css';

const db = (v: number) => `${v.toFixed(1)} dB`;

/** Observation log for one sample point: every value straight from the data. */
export function SiteReadout({
  point,
  index,
  total,
  onStep,
}: {
  point: LocatedPoint | null;
  index: number;
  total: number;
  onStep: (delta: 1 | -1) => void;
}) {
  const stepper = (
    <div className="flex items-center gap-2">
      <button type="button" className={primitives.ghost} onClick={() => onStep(-1)}>
        <span aria-hidden>←</span> Prev
      </button>
      <button type="button" className={primitives.ghost} onClick={() => onStep(1)}>
        Next <span aria-hidden>→</span>
      </button>
      <span className={primitives.micro} aria-live="polite">
        {point ? `${index + 1} / ${total}` : `${total} sites`}
      </span>
    </div>
  );

  if (!point) {
    return (
      <div className="space-y-3">
        <p className="text-xs leading-relaxed text-muted-foreground">
          Select a point on the map, or step through the sample sites.
        </p>
        {stepper}
      </div>
    );
  }

  const rows: [string, ReactNode][] = [
    ['Position', <span className="type-coord">{formatLonLat([point.lon, point.lat], 0.001)}</span>],
    [
      'History',
      point.status === 'burned'
        ? `Burned ${point.fire_year} · ${point.age_years} y`
        : 'Unburned reference',
    ],
    [
      'Canopy rh98',
      <>
        <span className="text-foreground">{point.rh98_m.toFixed(1)} m</span>{' '}
        <span className="text-muted-foreground">
          {STAGE_LABELS[point.lidar_stage]} · GEDI {point.gedi_year}
        </span>
      </>,
    ],
    ['NISAR HV / HH', `${db(point.nisar_hv_db)} / ${db(point.nisar_hh_db)}`],
    ['NISAR acquired', <span className="type-coord">{point.nisar_date ?? 'not available'}</span>],
    ['Sentinel-1 VH', db(point.s1_vh_db)],
    ['NDVI', point.ndvi.toFixed(2)],
    ['Elevation', `${Math.round(point.elev_m)} m · slope ${point.slope_deg.toFixed(1)}°`],
  ];

  return (
    <div className="space-y-3">
      <p className={primitives.micro}>
        Site <span className="type-coord text-foreground normal-case">{point.point_id}</span>
      </p>
      <table className={styles.log}>
        <caption className="sr-only">Observations for sample site {point.point_id}</caption>
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}>
              <th scope="row">{k}</th>
              <td>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {point.status === 'burned' && (
        <a href={recoveryHref(point.group_id)} className={primitives.ghost}>
          Recovery of its burn group <span aria-hidden>↗</span>
        </a>
      )}
      {stepper}
    </div>
  );
}
