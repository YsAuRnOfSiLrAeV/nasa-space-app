/**
 * Forest 3D: an isolated, lazily loaded Three.js illustration of forest
 * structure. Import only through this entry (or lazily), never from the
 * landing globe or the map, so the feature can be developed and removed alone.
 */
export { ForestViewer } from './ForestViewer';
export type { ForestStandInput, StandParams } from './recoveryAdapter';
