/**
 * Headline figures derived from loaded data, computed once and presented
 * differently by each theme. Never hardcoded: they update with the data.
 */
import type { Manifest, PointProperties } from '@/data/schema';
import { formatLat } from '@/domain/globe/graticule';
import { signalRho } from './signalEvidence';

export interface StudyFigure {
  id: 'points' | 'burnGroups' | 'fireYears' | 'nisarRho' | 'extent';
  label: string;
  value: string;
  /** Short unit or qualifier shown next to the value. */
  unit?: string;
}

export function computeStudyFigures(manifest: Manifest, points: PointProperties[]): StudyFigure[] {
  const years = manifest.fire_years;
  const rho = signalRho(points, 'nisar_hv_db');
  const [, south, , north] = manifest.bbox;

  return [
    { id: 'points', label: 'Sample points', value: String(manifest.counts.points) },
    { id: 'burnGroups', label: 'Burn-scar groups', value: String(manifest.counts.burned_groups) },
    {
      id: 'fireYears',
      label: 'Fire years',
      value:
        years.length === 0
          ? 'n/a'
          : years.length === 1
            ? `${years[0]}`
            : `${years[0]}–${years[years.length - 1]}`,
    },
    {
      id: 'nisarRho',
      label: 'NISAR HV ρ vs height',
      value: Number.isFinite(rho) ? rho.toFixed(2) : 'n/a',
      unit: 'Spearman',
    },
    {
      id: 'extent',
      label: 'Latitude extent',
      value: `${formatLat(south, 0.01)}–${formatLat(north, 0.01)}`,
    },
  ];
}
