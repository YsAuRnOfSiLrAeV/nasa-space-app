import type { StudyMapController } from '@/components/map/StudyMapController';
import type { StudyLoad, StudyView } from '@/components/study/studyView';
import type { MapState } from '@/app/route';

export type { StudyLoad, StudyView };

/**
 * Everything a theme composition may present. Compositions arrange and style
 * these; they never load data, compute statistics or call MapLibre.
 * Elements that cover the map must carry `data-map-occluder`.
 */
export interface CompositionProps {
  /** Loading / error state, for the shared StudyStateView and status lines. */
  load: StudyLoad;
  /** The loaded study, or null until it exists: one check, fully typed after it. */
  study: StudyView | null;
  /**
   * The map, through its controller (null until the map is ready). Compositions
   * ask for intent (focus, fit, layers, projection); overrides are undone
   * automatically on theme switch.
   */
  mapView: StudyMapController | null;
  mapState: MapState;
}
