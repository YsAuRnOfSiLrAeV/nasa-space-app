import { cn } from '@/lib/utils';
import { formatLat, formatLon } from '@/components/map/graticule';
import type { BurnGroup } from '@/components/study/burnGroups';
import styles from './LivingAtlas.module.css';

/**
 * Field-log table of the burn-scar groups (all values from the loaded points).
 * Each row locates its group on the map.
 */
export function BurnRegister({
  groups,
  focusId,
  onLocate,
}: {
  groups: BurnGroup[];
  focusId: string | null;
  onLocate: (g: BurnGroup) => void;
}) {
  if (groups.length === 0) {
    return <p className="prose-text text-xs italic">No burned points in this dataset.</p>;
  }
  return (
    <table className={styles.register}>
      <caption className="sr-only">
        Burn-scar groups: fire year, years since fire, sample points, median canopy height and share
        of points at least 10 m tall. Select a year to locate the group on the map.
      </caption>
      <thead>
        <tr>
          <th scope="col">Burned</th>
          <th scope="col">Age</th>
          <th scope="col">n</th>
          <th scope="col">Median</th>
          <th scope="col">≥10 m</th>
        </tr>
      </thead>
      <tbody>
        {groups.map((g) => {
          const active = g.id === focusId;
          return (
            <tr key={g.id} className={cn(active && styles.registerActive)}>
              <th scope="row">
                <button
                  type="button"
                  aria-pressed={active}
                  aria-label={`Locate the group burned in ${g.fireYear} (${g.count} points) at ${formatLat(g.centroid[1], 0.01)} ${formatLon(g.centroid[0], 0.01)}`}
                  onClick={() => onLocate(g)}
                >
                  <span aria-hidden className={styles.registerRing} />
                  {g.fireYear}
                </button>
              </th>
              <td>{g.ageYears} y</td>
              <td>{g.count}</td>
              <td>{g.medianHeightM.toFixed(1)} m</td>
              <td>{Math.round(g.shareTall * 100)}%</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
