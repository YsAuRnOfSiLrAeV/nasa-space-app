/**
 * Map source and layer ids (DOM-free so Node tests can import it).
 * Convention: `<entity>-<role>`; sources are named after the entity.
 * The `points-` prefix is reserved for app overlays (checked by map:validate).
 */
export const SOURCE_POINTS = 'points';
export const LAYER_POINTS = 'points-circle';
export const LAYER_POINT_GLOW = 'points-glow';
export const LAYER_POINT_SELECTED = 'points-selected';
/** Basemap layers in public/map/explorer.json, hidden unless a theme enables them. */
export const LAYER_IMAGERY = 'imagery';
export const LAYER_HILLSHADE = 'hillshade';
