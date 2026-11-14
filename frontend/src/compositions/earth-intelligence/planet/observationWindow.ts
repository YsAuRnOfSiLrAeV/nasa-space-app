import type { RecoveryFile, RecoveryImage } from '@/data/recoverySchema';

/** Ground width of a bbox in km, at its mid-latitude (the scene crops are square on the ground). */
export function groundWidthKm([west, south, east, north]: readonly [
  number,
  number,
  number,
  number,
]): number {
  const lat = ((south + north) / 2) * (Math.PI / 180);
  return Math.abs(east - west) * 111.32 * Math.cos(lat);
}

/** The most recent rendered scene: what the forest looks like from orbit now. */
export function latestImage(record: RecoveryFile): RecoveryImage | null {
  return [...record.images].sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
}
