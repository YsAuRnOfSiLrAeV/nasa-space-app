import { useEffect, useState } from 'react';
import type { StudyMapController } from '@/components/map/StudyMapController';

export interface AtlasLayers {
  relief: boolean;
  points: boolean;
  /** Burn-scar call-outs; drawn by this theme, not by the map. */
  annotations: boolean;
}

/**
 * The atlas layer switches and their effect on the map. The map resets its
 * layers itself on a theme switch, so there is nothing to undo on unmount.
 */
export function useAtlasLayers(mapView: StudyMapController | null) {
  const [layers, setLayers] = useState<AtlasLayers>({
    relief: true,
    points: true,
    annotations: true,
  });
  useEffect(() => {
    mapView?.setLayerVisible('relief', layers.relief);
    mapView?.setLayerVisible('points', layers.points);
  }, [mapView, layers.relief, layers.points]);
  return [layers, setLayers] as const;
}
