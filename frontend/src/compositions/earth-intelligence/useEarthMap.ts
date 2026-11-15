import { useEffect, useRef } from 'react';
import type { StudyMapController } from '@/components/map/StudyMapController';

/**
 * Earth Intelligence's map presentation: a globe (planet → region on the real
 * Earth), luminous points (p01) and click selection drawn as a white ring (p04).
 * No cleanup: the composition and the map live for the whole visit.
 */
export function useEarthMap(
  mapView: StudyMapController | null,
  selectedId: string | null,
  onPick: (pointId: string) => void,
) {
  const onPickRef = useRef(onPick);
  useEffect(() => {
    onPickRef.current = onPick;
  });

  useEffect(() => {
    if (!mapView) return;
    mapView.setProjection('globe');
    mapView.showPointGlow();
    mapView.enablePointSelection((id) => onPickRef.current(id));
  }, [mapView]);

  useEffect(() => {
    mapView?.setSelectedPoint(selectedId);
  }, [mapView, selectedId]);
}
