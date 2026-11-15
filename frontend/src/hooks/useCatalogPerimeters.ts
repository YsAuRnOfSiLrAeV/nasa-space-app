import { useEffect } from 'react';
import type { StudyMapController } from '@/components/map/StudyMapController';
import { studyDataApi } from '@/services/data';
import { shownFires } from '@/data/visibleFires';
import { useResource } from './useResource';

/** Only the small catalog geometry is requested here; selected-fire data stays lazy. */
export function useCatalogPerimeters(
  mapView: StudyMapController | null,
  selectedId: string | null,
) {
  const resource = useResource(mapView ? 'catalog-perimeters' : null, async (signal) => {
    const [perimeters, index] = await Promise.all([
      studyDataApi.loadFirePerimeters(signal),
      studyDataApi.loadFireIndex(signal),
    ]);
    if (!perimeters) return perimeters;
    const shown = new Set(shownFires(index).map((fire) => fire.id));
    return {
      ...perimeters,
      features: perimeters.features.filter((f) => shown.has(f.properties.id)),
    };
  });
  const data = resource.state.status === 'ready' ? resource.state.data : null;
  useEffect(() => {
    if (!mapView || !data) return;
    mapView.showCatalogPerimeters(data, selectedId);
  }, [mapView, data, selectedId]);
  useEffect(() => () => mapView?.hideCatalogPerimeters(), [mapView]);
  return resource;
}
