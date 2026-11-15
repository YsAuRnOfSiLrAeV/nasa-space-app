/**
 * "Which signal tracks canopy height?" (pure, tested): the satellite signals
 * compared with GEDI canopy height, and their Spearman ρ. Computed here once,
 * so the ranking, the panels and the headline figure all show the same number.
 */
import type { PointProperties } from '@/data/schema';
import { spearman } from '@/lib/stats';

export type SignalKey = 'nisar_hv_db' | 's1_vh_db' | 'ndvi';

export interface SignalSpec {
  key: SignalKey;
  label: string;
  detail: string;
  unit: string;
}

export const SIGNALS: SignalSpec[] = [
  { key: 'nisar_hv_db', label: 'NISAR HV', detail: 'L-band', unit: 'dB' },
  { key: 's1_vh_db', label: 'Sentinel-1 VH', detail: 'C-band', unit: 'dB' },
  { key: 'ndvi', label: 'NDVI', detail: 'optical', unit: '' },
];

/** Spearman ρ between GEDI canopy height and one signal, over the given points. */
export function signalRho(points: PointProperties[], key: SignalKey): number {
  return spearman(
    points.map((p) => p.rh98_m),
    points.map((p) => p[key]),
  );
}

/** Every signal with its ρ, strongest first. */
export function rankSignals(points: PointProperties[]): { signal: SignalSpec; rho: number }[] {
  return SIGNALS.map((signal) => ({ signal, rho: signalRho(points, signal.key) })).sort(
    (a, b) => b.rho - a.rho,
  );
}
