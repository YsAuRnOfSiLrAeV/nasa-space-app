/**
 * Forest 3D: an isolated, lazily loaded Three.js illustration of forest
 * structure. Import only through this entry (or lazily), never from the
 * landing globe or the map, so the feature can be developed and removed alone.
 */
export { ForestViewer, type ViewerLabel } from './ForestViewer';
export {
  GROWTH_STAND,
  ILLUSTRATIVE_STAND,
  MATURE_GROWTH,
  REFERENCE_GROWTH,
  growthFromRecovery,
  standFromInput,
} from './recoveryAdapter';
export type { ForestStandInput, GrowthParams, StandParams } from './recoveryAdapter';
