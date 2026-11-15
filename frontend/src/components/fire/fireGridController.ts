import type { StudyMapController } from '@/components/map/StudyMapController';

/** Map capabilities used by the fire overlay; camera and routing APIs are excluded. */
export type FireGridController = Pick<
  StudyMapController,
  'showFireGrid' | 'setFireOverlays' | 'clearFireGrid' | 'setFireHighlight' | 'onFirePointer'
>;
