import type { DemoFire } from './fireSchema';

/**
 * Fires exported as outline plus summary only (no cell map) are left out of the catalog,
 * the globe, the map and Find Your Fire. Set to true to show all 80 fires again.
 */
export const SHOW_SUMMARY_ONLY_FIRES = false;

/** Whether the app lists this fire. */
export const isShown = (fire: DemoFire): boolean =>
  SHOW_SUMMARY_ONLY_FIRES || fire.capabilities?.spatial !== false;

export const shownFires = (fires: DemoFire[]): DemoFire[] => fires.filter(isShown);
