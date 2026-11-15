/**
 * The satellite missions the study's data comes from, with their real orbit
 * inclinations. The one place these facts live: the landing globe draws its
 * orbits from it, its screen-reader text is built from it, and the GEDI
 * coverage limit is derived from it. A test holds it to `sources.ts`.
 *
 * Inclinations (degrees):
 * - GEDI flies on the International Space Station: 51.6.
 * - Landsat 8 and 9 share a sun-synchronous orbit: 98.2.
 * - NISAR: 98.4 (sun-synchronous).
 */
export interface Mission {
  id: 'gedi' | 'landsat' | 'nisar';
  /** Short on-screen label. */
  label: string;
  /** Name as it should be read aloud. */
  spoken: string;
  inclination: number;
}

export const MISSIONS = [
  {
    id: 'gedi',
    label: 'GEDI · ISS',
    spoken: 'GEDI on the International Space Station',
    inclination: 51.6,
  },
  { id: 'landsat', label: 'Landsat 8 · 9', spoken: 'Landsat 8 and 9', inclination: 98.2 },
  { id: 'nisar', label: 'NISAR', spoken: 'NISAR', inclination: 98.4 },
] as const satisfies readonly Mission[];

export type MissionId = Mission['id'];

export function mission(id: MissionId): Mission {
  return MISSIONS.find((m) => m.id === id)!;
}

/**
 * GEDI's orbital coverage boundary: it samples only between this latitude north
 * and south (the ISS inclination). Not a NISAR or study-area boundary.
 */
export const GEDI_LIMIT_LAT = mission('gedi').inclination;

/** "GEDI on the International Space Station (51.6° inclination), Landsat 8 and 9 (98.2°) and NISAR (98.4°)". */
export function describeOrbits(): string {
  const parts = MISSIONS.map(
    (m, i) => `${m.spoken} (${m.inclination}°${i === 0 ? ' inclination' : ''})`,
  );
  return `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`;
}
