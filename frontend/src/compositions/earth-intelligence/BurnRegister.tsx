import { cn } from '@/lib/utils';
import { formatLonLat } from '@/domain/globe/graticule';
import type { BurnGroup } from '@/domain/study/burnGroups';
import primitives from '@/components/shell/primitives.module.css';

/**
 * Burn-scar register: one row per burn-scar group, all values from the loaded
 * points. Picking a fire year flies the map to that group and highlights it on
 * the map and in the point cloud.
 */
export function BurnRegister({
  groups,
  focusId,
  onLocate,
}: {
  groups: BurnGroup[];
  focusId: string | null;
  onLocate: (group: BurnGroup) => void;
}) {
  if (groups.length === 0) {
    return <p className="text-xs text-muted-foreground">No burned points in this dataset.</p>;
  }
  // Oldest fire first reads as a recovery timeline.
  const rows = [...groups].sort((a, b) => a.fireYear - b.fireYear || b.count - a.count);
  return (
    <table className={primitives.register}>
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
        {rows.map((g) => {
          const active = g.id === focusId;
          return (
            <tr key={g.id} className={cn(active && primitives.registerActive)}>
              <th scope="row">
                <button
                  type="button"
                  aria-pressed={active}
                  aria-label={`Locate burn group ${g.label} (${g.count} points) at ${formatLonLat(g.centroid)}`}
                  onClick={() => onLocate(g)}
                >
                  <span aria-hidden className={primitives.registerRing} />
                  {g.label}
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
