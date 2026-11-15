import type { StudyMapController } from '@/components/map/StudyMapController';
import type { StudyLoad, StudyView } from '@/domain/study/studyView';
import type { MapState } from '@/app/route';

export type { StudyLoad, StudyView };

/**
 * Everything the explorer composition presents. It arranges and styles these;
 * it never loads data, computes statistics or calls MapLibre.
 * Elements that cover the map must carry `data-map-occluder`.
 */
export interface CompositionProps {
  /** Loading / error state, for the shared StudyStateView and status lines. */
  load: StudyLoad;
  /** The loaded study, or null until it exists: one check, fully typed after it. */
  study: StudyView | null;
  /**
   * The map, through its controller (null until the map is ready). The composition
   * asks for intent (focus, fit, projection, fire layers).
   */
  mapView: StudyMapController | null;
  mapState: MapState;
}
